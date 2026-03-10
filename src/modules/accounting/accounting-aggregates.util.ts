import { QueryTypes, Transaction } from "sequelize";
import sequelize from "../../config/db.config";
import { centsToMoneyString, moneyToCents } from "./money.util";

export interface IMoneyTotals {
  totalIn: string;
  totalOut: string;
  net: string;
}

const toSafeMoney = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "0.00";
  }

  if (typeof value === "number") {
    return value.toFixed(2);
  }

  return String(value);
};

const normalizeTotals = (row: {
  totalIn: unknown;
  totalOut: unknown;
}): IMoneyTotals => {
  const totalIn = toSafeMoney(row.totalIn);
  const totalOut = toSafeMoney(row.totalOut);

  const netCents = moneyToCents(totalIn) - moneyToCents(totalOut);

  return {
    totalIn,
    totalOut,
    net: centsToMoneyString(netCents),
  };
};

export const getShiftTotals = async (
  centerId: number,
  shiftId: number,
  transaction?: Transaction,
): Promise<IMoneyTotals> => {
  const rows = await sequelize.query<{ totalIn: unknown; totalOut: unknown }>(
    `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) AS totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) AS totalOut
      FROM transactions
      WHERE centerId = :centerId
        AND shiftId = :shiftId
    `,
    {
      replacements: { centerId, shiftId },
      transaction,
      type: QueryTypes.SELECT,
    },
  );

  return normalizeTotals(rows[0] ?? { totalIn: "0.00", totalOut: "0.00" });
};

export const getCenterLocalDateTotals = async (
  centerId: number,
  localDate: string,
  transaction?: Transaction,
): Promise<IMoneyTotals> => {
  const rows = await sequelize.query<{ totalIn: unknown; totalOut: unknown }>(
    `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) AS totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) AS totalOut
      FROM transactions
      WHERE centerId = :centerId
        AND localDate = :localDate
    `,
    {
      replacements: { centerId, localDate },
      transaction,
      type: QueryTypes.SELECT,
    },
  );

  return normalizeTotals(rows[0] ?? { totalIn: "0.00", totalOut: "0.00" });
};

export const getCenterLocalDateRangeTotals = async (
  centerId: number,
  dateFrom: string,
  dateTo: string,
  transaction?: Transaction,
): Promise<IMoneyTotals> => {
  const rows = await sequelize.query<{ totalIn: unknown; totalOut: unknown }>(
    `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) AS totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) AS totalOut
      FROM transactions
      WHERE centerId = :centerId
        AND localDate BETWEEN :dateFrom AND :dateTo
    `,
    {
      replacements: { centerId, dateFrom, dateTo },
      transaction,
      type: QueryTypes.SELECT,
    },
  );

  return normalizeTotals(rows[0] ?? { totalIn: "0.00", totalOut: "0.00" });
};
