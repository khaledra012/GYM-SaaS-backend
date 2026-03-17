import { StaffRole } from "./staff.model";

export const normalizeStaffEmail = (value: string): string =>
  value.trim().toLowerCase();

export const normalizeOptionalPhone = (value?: string): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const isAssignableStaffRole = (role: StaffRole): boolean => {
  return role === "manager" || role === "receptionist";
};

