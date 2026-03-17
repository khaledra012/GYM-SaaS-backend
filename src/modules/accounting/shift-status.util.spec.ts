import {
  buildOpenShiftWhere,
  resolveEffectiveShiftStatus,
} from "./shift-status.util";

describe("shift-status.util", () => {
  it("treats a clean open shift as open", () => {
    expect(
      resolveEffectiveShiftStatus({
        status: "open",
        closedAt: null,
        actualEndingCash: null,
        discrepancy: null,
        closedBy: null,
        closedByStaffId: null,
      }),
    ).toBe("open");
  });

  it("treats an inconsistent shift with closing data as closed", () => {
    expect(
      resolveEffectiveShiftStatus({
        status: "open",
        closedAt: new Date("2026-03-17T10:00:00.000Z"),
        actualEndingCash: "150.00",
        discrepancy: "0.00",
        closedBy: 1,
        closedByStaffId: null,
      }),
    ).toBe("closed");
  });

  it("builds a strict open shift query", () => {
    expect(buildOpenShiftWhere(7)).toEqual({
      centerId: 7,
      status: "open",
      closedAt: null,
      actualEndingCash: null,
      discrepancy: null,
      closedBy: null,
      closedByStaffId: null,
    });
  });
});

