import { Op, Transaction } from "sequelize";
import sequelize from "../../config/db.config";
import {
  AppError,
  getDateOnlyInTimezone,
  normalizeTimezone,
} from "../../shared";
import AccountingTransaction, {
  AccountingTransactionCategory,
} from "./accounting-transaction.model";
import Shift from "./shift.model";
import { lockCenterRow } from "./center-lock.util";
import { toMoneyString } from "./money.util";

export interface IRecordAutomatedIncomeInput {
  centerId: number;
  amount: string | number;
  referenceType: string;
  referenceId: number;
  idempotencyKey: string;
  category?: AccountingTransactionCategory;
  description?: string;
  occurredAt?: Date;
  createdBy: number;
  centerTimezone?: string;
  transaction?: Transaction;
}

export interface IReverseAutomatedTransactionInput {
  centerId: number;
  originalIdempotencyKey: string;
  reversalIdempotencyKey: string;
  reason?: string;
  createdBy: number;
  occurredAt?: Date;
  centerTimezone?: string;
  transaction?: Transaction;
}

export interface IReverseByReferenceInput {
  centerId: number;
  referenceType: string;
  referenceId: number;
  reversalIdempotencyPrefix: string;
  reason?: string;
  createdBy: number;
  occurredAt?: Date;
  centerTimezone?: string;
  transaction?: Transaction;
}

class AccountingFacade {
  private async withTransaction<T>(
    externalTransaction: Transaction | undefined,
    callback: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    if (externalTransaction) {
      return callback(externalTransaction);
    }

    return sequelize.transaction(callback);
  }

  private async findOpenShift(
    centerId: number,
    transaction: Transaction,
  ): Promise<Shift> {
    const openShift = await Shift.findOne({
      where: {
        centerId,
        status: "open",
      },
      lock: true,
      transaction,
    });

    if (!openShift) {
      throw new AppError("لا يوجد وردية مفتوحة لتسجيل الحركة التلقائية", 400);
    }

    return openShift;
  }

  private async createReversalForOriginal(
    originalTransaction: AccountingTransaction,
    input: {
      centerId: number;
      shiftId: number;
      reversalIdempotencyKey: string;
      reason?: string;
      createdBy: number;
      occurredAt?: Date;
      centerTimezone?: string;
    },
    transaction: Transaction,
  ): Promise<AccountingTransaction> {
    const existingByKey = await AccountingTransaction.findOne({
      where: {
        centerId: input.centerId,
        idempotencyKey: input.reversalIdempotencyKey,
      },
      transaction,
      lock: true,
    });

    if (existingByKey) {
      return existingByKey;
    }

    const existingReversal = await AccountingTransaction.findOne({
      where: {
        centerId: input.centerId,
        reversalOfTransactionId: originalTransaction.id,
      },
      transaction,
      lock: true,
    });

    if (existingReversal) {
      return existingReversal;
    }

    const occurredAt = input.occurredAt ?? new Date();
    const timezone = normalizeTimezone(input.centerTimezone);
    const localDate = getDateOnlyInTimezone(occurredAt, timezone);

    const reversal = await AccountingTransaction.create(
      {
        centerId: input.centerId,
        shiftId: input.shiftId,
        type: "OUT",
        amount: originalTransaction.amount,
        category: originalTransaction.category,
        description: input.reason?.trim() || "عكس حركة تلقائية",
        referenceType: originalTransaction.referenceType,
        referenceId: originalTransaction.referenceId,
        localDate,
        occurredAt,
        source: "automated_reversal",
        idempotencyKey: input.reversalIdempotencyKey,
        reversalOfTransactionId: originalTransaction.id,
        createdBy: input.createdBy,
        metadata: {
          source: "automated_reversal",
          originalTransactionId: originalTransaction.id,
          originalIdempotencyKey: originalTransaction.idempotencyKey,
        },
      },
      { transaction },
    );

    originalTransaction.reversalOfTransactionId = reversal.id;
    await originalTransaction.save({ transaction });

    return reversal;
  }

  public async recordAutomatedIncome(
    input: IRecordAutomatedIncomeInput,
  ): Promise<AccountingTransaction> {
    return this.withTransaction(input.transaction, async (transaction) => {
      if (!input.idempotencyKey?.trim()) {
        throw new AppError("مفتاح منع التكرار مطلوب للحركة التلقائية", 400);
      }

      const existing = await AccountingTransaction.findOne({
        where: {
          centerId: input.centerId,
          idempotencyKey: input.idempotencyKey,
        },
        transaction,
        lock: true,
      });

      if (existing) {
        return existing;
      }

      await lockCenterRow(input.centerId, transaction);
      const openShift = await this.findOpenShift(input.centerId, transaction);

      const amount = toMoneyString(input.amount);
      if (amount === "0.00") {
        throw new AppError("قيمة الحركة يجب أن تكون أكبر من صفر", 400);
      }

      const occurredAt = input.occurredAt ?? new Date();
      const timezone = normalizeTimezone(input.centerTimezone);
      const localDate = getDateOnlyInTimezone(occurredAt, timezone);

      return AccountingTransaction.create(
        {
          centerId: input.centerId,
          shiftId: openShift.id,
          type: "IN",
          amount,
          category: input.category ?? "subscription",
          description: input.description?.trim() || null,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          localDate,
          occurredAt,
          source: "automated",
          idempotencyKey: input.idempotencyKey,
          reversalOfTransactionId: null,
          createdBy: input.createdBy,
          metadata: {
            source: "automated_income",
          },
        },
        { transaction },
      );
    });
  }

  public async reverseAutomatedTransaction(
    input: IReverseAutomatedTransactionInput,
  ): Promise<AccountingTransaction> {
    return this.withTransaction(input.transaction, async (transaction) => {
      if (!input.originalIdempotencyKey?.trim()) {
        throw new AppError("مفتاح الحركة الأصلية مطلوب", 400);
      }

      if (!input.reversalIdempotencyKey?.trim()) {
        throw new AppError("مفتاح منع التكرار لحركة العكس مطلوب", 400);
      }

      const original = await AccountingTransaction.findOne({
        where: {
          centerId: input.centerId,
          idempotencyKey: input.originalIdempotencyKey,
        },
        transaction,
        lock: true,
      });

      if (!original) {
        throw new AppError("الحركة الأصلية غير موجودة", 404);
      }

      if (original.source !== "automated" || original.type !== "IN") {
        throw new AppError("لا يمكن عكس هذه الحركة لأنها ليست إيرادًا تلقائيًا", 400);
      }

      await lockCenterRow(input.centerId, transaction);
      const openShift = await this.findOpenShift(input.centerId, transaction);

      return this.createReversalForOriginal(
        original,
        {
          centerId: input.centerId,
          shiftId: openShift.id,
          reversalIdempotencyKey: input.reversalIdempotencyKey,
          reason: input.reason,
          createdBy: input.createdBy,
          occurredAt: input.occurredAt,
          centerTimezone: input.centerTimezone,
        },
        transaction,
      );
    });
  }

  public async reverseAutomatedTransactionsByReference(
    input: IReverseByReferenceInput,
  ): Promise<{ count: number; transactions: AccountingTransaction[] }> {
    return this.withTransaction(input.transaction, async (transaction) => {
      const originals = await AccountingTransaction.findAll({
        where: {
          centerId: input.centerId,
          source: "automated",
          type: "IN",
          referenceType: input.referenceType,
          referenceId: input.referenceId,
        },
        order: [["id", "ASC"]],
        lock: true,
        transaction,
      });

      if (originals.length === 0) {
        return { count: 0, transactions: [] };
      }

      const originalIds = originals.map((item) => item.id);
      const existingReversals = await AccountingTransaction.findAll({
        where: {
          centerId: input.centerId,
          reversalOfTransactionId: {
            [Op.in]: originalIds,
          },
        },
        transaction,
        lock: true,
      });

      const reversalByOriginalId = new Map<number, AccountingTransaction>();
      for (const reversal of existingReversals) {
        if (reversal.reversalOfTransactionId !== null) {
          reversalByOriginalId.set(reversal.reversalOfTransactionId, reversal);
        }
      }

      const needsNewReversal = originals.some(
        (item) => !reversalByOriginalId.has(item.id),
      );

      let openShift: Shift | null = null;
      if (needsNewReversal) {
        await lockCenterRow(input.centerId, transaction);
        openShift = await this.findOpenShift(input.centerId, transaction);
      }

      const reversals: AccountingTransaction[] = [];

      for (const original of originals) {
        const existing = reversalByOriginalId.get(original.id);
        if (existing) {
          reversals.push(existing);
          continue;
        }

        const reversalIdempotencyKey = `${input.reversalIdempotencyPrefix}:${original.id}`;
        const reversal = await this.createReversalForOriginal(
          original,
          {
            centerId: input.centerId,
            shiftId: openShift!.id,
            reversalIdempotencyKey,
            reason: input.reason,
            createdBy: input.createdBy,
            occurredAt: input.occurredAt,
            centerTimezone: input.centerTimezone,
          },
          transaction,
        );

        reversals.push(reversal);
      }

      return {
        count: reversals.length,
        transactions: reversals,
      };
    });
  }
}

export const accountingFacade = new AccountingFacade();



