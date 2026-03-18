import {
  isAssignableStaffRole,
  normalizeOptionalPhone,
  normalizeStaffEmail,
} from "./staff.util";

describe("staff.util", () => {
  it("normalizes staff email", () => {
    expect(normalizeStaffEmail("  USER@MAIL.COM ")).toBe("user@mail.com");
  });

  it("normalizes optional phone", () => {
    expect(normalizeOptionalPhone(" 01012345678 ")).toBe("01012345678");
    expect(normalizeOptionalPhone("   ")).toBeNull();
    expect(normalizeOptionalPhone(undefined)).toBeNull();
  });

  it("allows only manager and receptionist roles for assignment", () => {
    expect(isAssignableStaffRole("owner")).toBe(false);
    expect(isAssignableStaffRole("manager")).toBe(true);
    expect(isAssignableStaffRole("receptionist")).toBe(true);
  });
});

