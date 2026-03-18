import { Op } from "sequelize";
import { ShiftStatus } from "./shift.model";

type ShiftStatusLike = {
  status: ShiftStatus;
  closedAt: Date | null;
  actualEndingCash: string | null;
  discrepancy: string | null;
  closedBy: number | null;
  closedByStaffId: number | null;
};

export const hasShiftClosingData = (shift: ShiftStatusLike): boolean => {
  return (
    shift.closedAt !== null ||
    shift.actualEndingCash !== null ||
    shift.discrepancy !== null ||
    shift.closedBy !== null ||
    shift.closedByStaffId !== null
  );
};

export const resolveEffectiveShiftStatus = (
  shift: ShiftStatusLike,
): ShiftStatus => {
  if (shift.status === "closed" || hasShiftClosingData(shift)) {
    return "closed";
  }

  return "open";
};

export const buildOpenShiftWhere = (centerId: number) => ({
  centerId,
  status: "open" as const,
  closedAt: null,
  actualEndingCash: null,
  discrepancy: null,
  closedBy: null,
  closedByStaffId: null,
});

export const buildClosedShiftWhere = (centerId: number) => ({
  centerId,
  [Op.or]: [
    { status: "closed" as const },
    { closedAt: { [Op.ne]: null } },
    { actualEndingCash: { [Op.ne]: null } },
    { discrepancy: { [Op.ne]: null } },
    { closedBy: { [Op.ne]: null } },
    { closedByStaffId: { [Op.ne]: null } },
  ],
});

