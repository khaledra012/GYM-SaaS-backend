import {
  col,
  FindAndCountOptions,
  fn,
  Includeable,
  Op,
  Transaction,
  WhereOptions,
} from "sequelize";
import sequelize from "../../config/db.config";
import { AppError, getDateOnlyInTimezone, normalizeTimezone } from "../../shared";
import { memberReadFacade } from "../member/member.facade";
import { accountingFacade } from "../accounting/accounting.facade";
import Member from "../member/member.model";
import Debt from "./debt.model";
import DebtPayment from "./debt-payment.model";
import { DebtPaymentType, DebtSource } from "./debt.types";
import {
  applyDebtPayment,
  centsToMoneyString,
  getDebtPaymentTypeLabel,
  getDebtSourceLabel,
  getDebtStatusLabel,
} from "./debt.util";
import {
  ICreateDebtDTO,
  ICreateDebtPaymentDTO,
  IDebtsSummaryQuery,
  IListDebtsQuery,
  IMemberDebtsQuery,
} from "./debt.schema";

interface IListDebtsInput {
  centerId: number;
  query: IListDebtsQuery | IMemberDebtsQuery;
}

interface ICreateAutomatedDebtInput {
  centerId: number;
  memberId: number;
  amountCents: number;
  title: string;
  note?: string | null;
  source: DebtSource;
  referenceType: string;
  referenceId: number;
  createdBy: number;
  occurredAt?: Date;
  centerTimezone?: string;
  transaction?: Transaction;
}

interface ISettleDebtsByAdjustmentInput {
  centerId: number;
  referenceType: string;
  referenceId: number;
  note: string;
  createdBy: number;
  occurredAt?: Date;
  centerTimezone?: string;
  transaction?: Transaction;
}

interface ICreatePaymentInternalInput {
  debt: Debt;
  amountCents: number;
  type: DebtPaymentType;
  note?: string | null;
  createdBy: number;
  centerTimezone?: string;
  occurredAt?: Date;
  transaction: Transaction;
}

interface IDebtSummary {
  totalOriginalAmountCents: number;
  totalPaidAmountCents: number;
  totalRemainingAmountCents: number;
  totalOriginalAmount: string;
  totalPaidAmount: string;
  totalRemainingAmount: string;
  unpaidCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  outstandingDebtsCount: number;
  membersWithOutstandingDebtsCount: number;
}

class DebtService {
  private resolveLocalDate(
    occurredAt: Date | undefined,
    centerTimezone?: string,
  ): { occurredAt: Date; localDate: string } {
    const resolvedOccurredAt = occurredAt ?? new Date();
    const timezone = normalizeTimezone(centerTimezone);
    const localDate = getDateOnlyInTimezone(resolvedOccurredAt, timezone);

    return {
      occurredAt: resolvedOccurredAt,
      localDate,
    };
  }

  private trimOptionalText(value?: string | null): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private withTransaction<T>(
    externalTransaction: Transaction | undefined,
    callback: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    if (externalTransaction) {
      return callback(externalTransaction);
    }

    return sequelize.transaction(callback);
  }

  private resolveDateRange(query: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    startDate?: string;
    endDate?: string;
  }): { dateFrom?: string; dateTo?: string } {
    if (query.date) {
      return {
        dateFrom: query.date,
        dateTo: query.date,
      };
    }

    return {
      dateFrom: query.dateFrom ?? query.startDate,
      dateTo: query.dateTo ?? query.endDate,
    };
  }

  private buildListFilters(
    centerId: number,
    query: IListDebtsQuery | IMemberDebtsQuery,
  ): {
    where: WhereOptions;
    include: Includeable[];
  } {
    const whereConditions: WhereOptions[] = [{ centerId }];
    const search = query.search?.trim();
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    const memberId = "memberId" in query ? query.memberId : undefined;

    if (memberId) {
      whereConditions.push({ memberId });
    }

    if (query.status) {
      whereConditions.push({ status: query.status });
    } else if (query.outstandingOnly === "true") {
      whereConditions.push({
        status: {
          [Op.in]: ["unpaid", "partially_paid"],
        },
      });
    }

    if (dateFrom && dateTo) {
      whereConditions.push({
        localDate: {
          [Op.between]: [dateFrom, dateTo],
        },
      });
    } else if (dateFrom) {
      whereConditions.push({
        localDate: {
          [Op.gte]: dateFrom,
        },
      });
    } else if (dateTo) {
      whereConditions.push({
        localDate: {
          [Op.lte]: dateTo,
        },
      });
    }

    if (search) {
      whereConditions.push({
        [Op.or]: [
          { title: { [Op.like]: `%${search}%` } },
          { note: { [Op.like]: `%${search}%` } },
          { "$member.name$": { [Op.like]: `%${search}%` } },
          { "$member.phone$": { [Op.like]: `%${search}%` } },
          { "$member.code$": { [Op.like]: `%${search}%` } },
        ],
      });
    }

    return {
      where:
        whereConditions.length === 1
          ? whereConditions[0]
          : {
              [Op.and]: whereConditions,
            },
      include: [
        {
          model: Member,
          as: "member",
          attributes: ["id", "code", "name", "phone", "status"],
          required: true,
        },
      ],
    };
  }

  private mapDebt(debt: Debt, options?: { paymentsMeta?: Map<number, any> }) {
    const data = debt.toJSON() as any;
    const paymentsMeta = options?.paymentsMeta?.get(data.id);

    return {
      id: data.id,
      centerId: data.centerId,
      memberId: data.memberId,
      source: data.source,
      sourceLabel: getDebtSourceLabel(data.source),
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      title: data.title,
      note: data.note,
      originalAmountCents: data.originalAmountCents,
      originalAmount: centsToMoneyString(data.originalAmountCents),
      paidAmountCents: data.paidAmountCents,
      paidAmount: centsToMoneyString(data.paidAmountCents),
      remainingAmountCents: data.remainingAmountCents,
      remainingAmount: centsToMoneyString(data.remainingAmountCents),
      status: data.status,
      statusLabel: getDebtStatusLabel(data.status),
      localDate: data.localDate,
      createdBy: data.createdBy,
      version: data.version,
      canSettle: data.remainingAmountCents > 0,
      paymentsCount: paymentsMeta?.paymentsCount ?? 0,
      lastPaymentAt: paymentsMeta?.lastPaymentAt ?? null,
      member: data.member
        ? {
            id: data.member.id,
            code: data.member.code,
            name: data.member.name,
            phone: data.member.phone,
            status: data.member.status,
          }
        : null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private mapDebtPayment(payment: DebtPayment) {
    const data = payment.toJSON() as any;

    return {
      id: data.id,
      debtId: data.debtId,
      type: data.type,
      typeLabel: getDebtPaymentTypeLabel(data.type),
      amountCents: data.amountCents,
      amount: centsToMoneyString(data.amountCents),
      note: data.note,
      affectsAccounting: data.affectsAccounting,
      paidAt: data.paidAt,
      localDate: data.localDate,
      createdBy: data.createdBy,
      accountingTransactionId: data.accountingTransactionId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private async getPaymentsMetaMap(
    centerId: number,
    debtIds: number[],
  ): Promise<Map<number, { paymentsCount: number; lastPaymentAt: Date | null }>> {
    if (debtIds.length === 0) {
      return new Map();
    }

    const rows = (await DebtPayment.findAll({
      attributes: [
        "debtId",
        [fn("COUNT", col("id")), "paymentsCount"],
        [fn("MAX", col("paidAt")), "lastPaymentAt"],
      ],
      where: {
        centerId,
        debtId: {
          [Op.in]: debtIds,
        },
      },
      group: ["debtId"],
      raw: true,
    })) as unknown as Array<{
      debtId: number;
      paymentsCount: string;
      lastPaymentAt: Date | null;
    }>;

    const result = new Map<number, { paymentsCount: number; lastPaymentAt: Date | null }>();
    for (const row of rows) {
      result.set(Number(row.debtId), {
        paymentsCount: Number(row.paymentsCount),
        lastPaymentAt: row.lastPaymentAt ?? null,
      });
    }

    return result;
  }

  private async buildSummary(
    centerId: number,
    query: IDebtsSummaryQuery | { memberId?: number },
  ): Promise<IDebtSummary> {
    const { where, include } = this.buildListFilters(centerId, {
      page: 1,
      limit: 1,
      outstandingOnly: undefined,
      search: undefined,
      status: undefined,
      ...query,
    });

    const [
      totalOriginalRaw,
      totalPaidRaw,
      totalRemainingRaw,
      unpaidCount,
      partiallyPaidCount,
      paidCount,
    ] = await Promise.all([
      Debt.sum("originalAmountCents", { where, include } as any),
      Debt.sum("paidAmountCents", { where, include } as any),
      Debt.sum("remainingAmountCents", { where, include } as any),
      Debt.count({ where: { [Op.and]: [where, { status: "unpaid" }] }, include }),
      Debt.count({
        where: { [Op.and]: [where, { status: "partially_paid" }] },
        include,
      }),
      Debt.count({ where: { [Op.and]: [where, { status: "paid" }] }, include }),
    ]);

    const membersWithOutstandingDebtsCount = await Debt.count({
      where: {
        [Op.and]: [
          where,
          {
            status: {
              [Op.in]: ["unpaid", "partially_paid"],
            },
          },
        ],
      },
      include,
      distinct: true,
      col: "memberId",
    });

    const totalOriginalAmountCents = Number(totalOriginalRaw ?? 0);
    const totalPaidAmountCents = Number(totalPaidRaw ?? 0);
    const totalRemainingAmountCents = Number(totalRemainingRaw ?? 0);

    return {
      totalOriginalAmountCents,
      totalPaidAmountCents,
      totalRemainingAmountCents,
      totalOriginalAmount: centsToMoneyString(totalOriginalAmountCents),
      totalPaidAmount: centsToMoneyString(totalPaidAmountCents),
      totalRemainingAmount: centsToMoneyString(totalRemainingAmountCents),
      unpaidCount,
      partiallyPaidCount,
      paidCount,
      outstandingDebtsCount: unpaidCount + partiallyPaidCount,
      membersWithOutstandingDebtsCount,
    };
  }

  private async createDebtRecord(
    input: {
      centerId: number;
      memberId: number;
      source: DebtSource;
      referenceType?: string | null;
      referenceId?: number | null;
      title: string;
      note?: string | null;
      amountCents: number;
      createdBy: number;
      occurredAt?: Date;
      centerTimezone?: string;
    },
    transaction: Transaction,
  ): Promise<Debt> {
    const member = await memberReadFacade.findByIdInCenter(input.memberId, input.centerId, {
      transaction,
      lock: true,
    });

    if (!member) {
      throw new AppError("العضو غير موجود", 404);
    }

    const { localDate } = this.resolveLocalDate(input.occurredAt, input.centerTimezone);
    return Debt.create(
      {
        centerId: input.centerId,
        memberId: input.memberId,
        source: input.source,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        title: input.title.trim(),
        note: this.trimOptionalText(input.note),
        originalAmountCents: input.amountCents,
        paidAmountCents: 0,
        remainingAmountCents: input.amountCents,
        status: "unpaid",
        localDate,
        createdBy: input.createdBy,
      },
      { transaction },
    );
  }

  private async createPaymentRecord(
    input: ICreatePaymentInternalInput,
  ): Promise<{ debt: Debt; payment: DebtPayment }> {
    const { debt, amountCents, type, note, createdBy, centerTimezone, occurredAt, transaction } =
      input;

    if (debt.remainingAmountCents <= 0) {
      throw new AppError("هذه المديونية مسددة بالكامل بالفعل", 400);
    }

    const nextAmounts = applyDebtPayment(
      debt.originalAmountCents,
      debt.paidAmountCents,
      amountCents,
    );

    const resolvedDate = this.resolveLocalDate(occurredAt, centerTimezone);

    let accountingTransactionId: number | null = null;
    if (type === "cash") {
      const accountingTransaction = await accountingFacade.recordDebtCollectionIncome({
        centerId: debt.centerId,
        debtId: debt.id,
        amountCents,
        description: note?.trim() || `تحصيل مديونية ${debt.title}`,
        createdBy,
        centerTimezone,
        occurredAt: resolvedDate.occurredAt,
        transaction,
      });

      accountingTransactionId = accountingTransaction.id;
    }

    const payment = await DebtPayment.create(
      {
        centerId: debt.centerId,
        debtId: debt.id,
        type,
        amountCents,
        note: this.trimOptionalText(note),
        affectsAccounting: type === "cash",
        paidAt: resolvedDate.occurredAt,
        localDate: resolvedDate.localDate,
        createdBy,
        accountingTransactionId,
      },
      { transaction },
    );

    debt.paidAmountCents = nextAmounts.paidAmountCents;
    debt.remainingAmountCents = nextAmounts.remainingAmountCents;
    debt.status = nextAmounts.status;
    await debt.save({ transaction });

    return { debt, payment };
  }

  public async createManualDebt(
    input: ICreateDebtDTO & {
      centerId: number;
      createdBy: number;
      centerTimezone?: string;
    },
  ) {
    return sequelize.transaction(async (transaction) => {
      const debt = await this.createDebtRecord(
        {
          centerId: input.centerId,
          memberId: input.memberId,
          source: "manual",
          title: input.title,
          note: input.note,
          amountCents: input.amountCents,
          createdBy: input.createdBy,
          centerTimezone: input.centerTimezone,
        },
        transaction,
      );

      const reloaded = await Debt.findByPk(debt.id, {
        include: [
          {
            model: Member,
            as: "member",
            attributes: ["id", "code", "name", "phone", "status"],
          },
        ],
        transaction,
      });

      return this.mapDebt(reloaded || debt);
    });
  }

  public async createAutomatedDebt(input: ICreateAutomatedDebtInput) {
    return this.withTransaction(input.transaction, async (transaction) => {
      if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
        return null;
      }

      return this.createDebtRecord(
        {
          centerId: input.centerId,
          memberId: input.memberId,
          source: input.source,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          title: input.title,
          note: input.note,
          amountCents: input.amountCents,
          createdBy: input.createdBy,
          occurredAt: input.occurredAt,
          centerTimezone: input.centerTimezone,
        },
        transaction,
      );
    });
  }

  public async settleOutstandingDebtsByAdjustment(input: ISettleDebtsByAdjustmentInput) {
    return this.withTransaction(input.transaction, async (transaction) => {
      const debts = await Debt.findAll({
        where: {
          centerId: input.centerId,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          status: {
            [Op.in]: ["unpaid", "partially_paid"],
          },
        },
        order: [["id", "ASC"]],
        lock: true,
        transaction,
      });

      const settledDebts: Debt[] = [];
      for (const debt of debts) {
        await this.createPaymentRecord({
          debt,
          amountCents: debt.remainingAmountCents,
          type: "adjustment",
          note: input.note,
          createdBy: input.createdBy,
          centerTimezone: input.centerTimezone,
          occurredAt: input.occurredAt,
          transaction,
        });

        settledDebts.push(debt);
      }

      return {
        count: settledDebts.length,
        debts: settledDebts,
      };
    });
  }

  public async listDebts(input: IListDebtsInput) {
    const { where, include } = this.buildListFilters(input.centerId, input.query);
    const offset = (input.query.page - 1) * input.query.limit;

    const options: FindAndCountOptions = {
      where,
      include,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: input.query.limit,
      offset,
      distinct: true,
    };

    const { rows, count } = await Debt.findAndCountAll(options);
    const debtIds = rows.map((row) => row.id);
    const paymentsMeta = await this.getPaymentsMetaMap(input.centerId, debtIds);

    return {
      total: count,
      page: input.query.page,
      limit: input.query.limit,
      totalPages: Math.ceil(count / input.query.limit),
      data: rows.map((row, index) => ({
        displayNumber: offset + index + 1,
        ...this.mapDebt(row, { paymentsMeta }),
      })),
    };
  }

  public async getSummary(centerId: number, query: IDebtsSummaryQuery) {
    return this.buildSummary(centerId, query);
  }

  public async getDebtById(id: number, centerId: number) {
    const debt = await Debt.findOne({
      where: { id, centerId },
      include: [
        {
          model: Member,
          as: "member",
          attributes: ["id", "code", "name", "phone", "status"],
          required: true,
        },
      ],
    });

    if (!debt) {
      throw new AppError("المديونية غير موجودة", 404);
    }

    const payments = await DebtPayment.findAll({
      where: { debtId: id, centerId },
      order: [
        ["paidAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    return {
      ...this.mapDebt(debt),
      payments: payments.map((payment) => this.mapDebtPayment(payment)),
    };
  }

  public async createDebtPayment(
    id: number,
    centerId: number,
    input: ICreateDebtPaymentDTO & {
      createdBy: number;
      centerTimezone?: string;
    },
  ) {
    return sequelize.transaction(async (transaction) => {
      const debt = await Debt.findOne({
        where: { id, centerId },
        lock: true,
        transaction,
      });

      if (!debt) {
        throw new AppError("المديونية غير موجودة", 404);
      }

      const { payment } = await this.createPaymentRecord({
        debt,
        amountCents: input.amountCents,
        type: input.type,
        note: input.note,
        createdBy: input.createdBy,
        centerTimezone: input.centerTimezone,
        transaction,
      });

      const reloaded = await Debt.findOne({
        where: { id, centerId },
        include: [
          {
            model: Member,
            as: "member",
            attributes: ["id", "code", "name", "phone", "status"],
            required: true,
          },
        ],
        transaction,
      });

      return {
        debt: this.mapDebt(reloaded || debt),
        payment: this.mapDebtPayment(payment),
      };
    });
  }

  public async listMemberDebts(
    memberId: number,
    centerId: number,
    query: IMemberDebtsQuery,
  ) {
    return this.listDebts({
      centerId,
      query: {
        ...query,
        memberId,
      },
    });
  }

  public async getMemberDebtSummary(memberId: number, centerId: number) {
    const member = await memberReadFacade.findByIdInCenter(memberId, centerId);
    if (!member) {
      throw new AppError("العضو غير موجود", 404);
    }

    const summary = await this.buildSummary(centerId, { memberId });

    return {
      memberId,
      totalDebtAmountCents: summary.totalOriginalAmountCents,
      totalDebtAmount: summary.totalOriginalAmount,
      outstandingDebtAmountCents: summary.totalRemainingAmountCents,
      outstandingDebtAmount: summary.totalRemainingAmount,
      totalPaidAmountCents: summary.totalPaidAmountCents,
      totalPaidAmount: summary.totalPaidAmount,
      unpaidCount: summary.unpaidCount,
      partiallyPaidCount: summary.partiallyPaidCount,
      paidCount: summary.paidCount,
      outstandingDebtCount: summary.outstandingDebtsCount,
    };
  }

  public async getMembersDebtSummary(memberIds: number[], centerId: number) {
    const uniqueMemberIds = Array.from(
      new Set(memberIds.filter((id) => Number.isInteger(id) && id > 0)),
    );

    const summaryByMemberId = new Map<
      number,
      {
        totalDebtAmountCents: number;
        totalDebtAmount: string;
        outstandingDebtAmountCents: number;
        outstandingDebtAmount: string;
        outstandingDebtCount: number;
      }
    >();

    if (uniqueMemberIds.length === 0) {
      return summaryByMemberId;
    }

    const totalsRows = (await Debt.findAll({
      attributes: [
        "memberId",
        [fn("SUM", col("originalAmountCents")), "totalDebtAmountCents"],
        [fn("SUM", col("remainingAmountCents")), "outstandingDebtAmountCents"],
      ],
      where: {
        centerId,
        memberId: {
          [Op.in]: uniqueMemberIds,
        },
      },
      group: ["memberId"],
      raw: true,
    })) as unknown as Array<{
      memberId: number;
      totalDebtAmountCents: string | number | null;
      outstandingDebtAmountCents: string | number | null;
    }>;

    const outstandingCountRows = (await Debt.findAll({
      attributes: ["memberId", [fn("COUNT", col("id")), "outstandingDebtCount"]],
      where: {
        centerId,
        memberId: {
          [Op.in]: uniqueMemberIds,
        },
        status: {
          [Op.in]: ["unpaid", "partially_paid"],
        },
      },
      group: ["memberId"],
      raw: true,
    })) as unknown as Array<{
      memberId: number;
      outstandingDebtCount: string | number | null;
    }>;

    for (const memberId of uniqueMemberIds) {
      summaryByMemberId.set(memberId, {
        totalDebtAmountCents: 0,
        totalDebtAmount: "0.00",
        outstandingDebtAmountCents: 0,
        outstandingDebtAmount: "0.00",
        outstandingDebtCount: 0,
      });
    }

    for (const row of totalsRows) {
      const memberId = Number(row.memberId);
      const totalDebtAmountCents = Number(row.totalDebtAmountCents ?? 0);
      const outstandingDebtAmountCents = Number(row.outstandingDebtAmountCents ?? 0);
      const current = summaryByMemberId.get(memberId);

      summaryByMemberId.set(memberId, {
        totalDebtAmountCents,
        totalDebtAmount: centsToMoneyString(totalDebtAmountCents),
        outstandingDebtAmountCents,
        outstandingDebtAmount: centsToMoneyString(outstandingDebtAmountCents),
        outstandingDebtCount: current?.outstandingDebtCount ?? 0,
      });
    }

    for (const row of outstandingCountRows) {
      const memberId = Number(row.memberId);
      const current = summaryByMemberId.get(memberId) ?? {
        totalDebtAmountCents: 0,
        totalDebtAmount: "0.00",
        outstandingDebtAmountCents: 0,
        outstandingDebtAmount: "0.00",
        outstandingDebtCount: 0,
      };

      summaryByMemberId.set(memberId, {
        ...current,
        outstandingDebtCount: Number(row.outstandingDebtCount ?? 0),
      });
    }

    return summaryByMemberId;
  }

  public buildAutomatedSubscriptionDebtTitle(context: {
    action: "create" | "renew_time" | "renew_sessions" | "renew_expired";
    subscriptionId: number;
  }) {
    switch (context.action) {
      case "renew_time":
        return `مديونية تجديد اشتراك زمني #${context.subscriptionId}`;
      case "renew_sessions":
        return `مديونية تجديد اشتراك حصص #${context.subscriptionId}`;
      case "renew_expired":
        return `مديونية تجديد اشتراك منتهي #${context.subscriptionId}`;
      case "create":
      default:
        return `مديونية اشتراك #${context.subscriptionId}`;
    }
  }

  public buildAutomatedSubscriptionDebtNote(context: {
    totalPriceCents: number;
    pricePaidCents: number;
  }) {
    return `مديونية تلقائية ناتجة عن اشتراك ناقص السداد. إجمالي المطلوب ${centsToMoneyString(
      context.totalPriceCents,
    )} والمدفوع ${centsToMoneyString(context.pricePaidCents)}.`;
  }
}

export const debtService = new DebtService();
