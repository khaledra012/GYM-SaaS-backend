import { QueryTypes, Transaction } from "sequelize";
import sequelize from "../../config/db.config";
import { AppError } from "../../shared";

export const lockCenterRow = async (
  centerId: number,
  transaction: Transaction,
): Promise<void> => {
  const rows = await sequelize.query<{ id: number }>(
    "SELECT id FROM centers WHERE id = :centerId FOR UPDATE",
    {
      replacements: { centerId },
      transaction,
      type: QueryTypes.SELECT,
    },
  );

  if (rows.length === 0) {
    throw new AppError("المركز غير موجود", 404);
  }
};
