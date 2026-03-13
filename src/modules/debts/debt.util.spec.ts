import {
  applyDebtPayment,
  centsToMoneyString,
  resolveDebtStatus,
} from "./debt.util";

describe("debt.util", () => {
  describe("resolveDebtStatus", () => {
    it("returns unpaid when nothing is paid", () => {
      expect(resolveDebtStatus(0, 1000)).toBe("unpaid");
    });

    it("returns partially_paid when part of the debt is paid", () => {
      expect(resolveDebtStatus(400, 600)).toBe("partially_paid");
    });

    it("returns paid when the remaining amount reaches zero", () => {
      expect(resolveDebtStatus(1000, 0)).toBe("paid");
    });
  });

  describe("applyDebtPayment", () => {
    it("updates amounts correctly for a partial payment", () => {
      expect(applyDebtPayment(1000, 200, 300)).toEqual({
        paidAmountCents: 500,
        remainingAmountCents: 500,
        status: "partially_paid",
      });
    });

    it("marks the debt as paid when the payment closes the full amount", () => {
      expect(applyDebtPayment(1000, 200, 800)).toEqual({
        paidAmountCents: 1000,
        remainingAmountCents: 0,
        status: "paid",
      });
    });

    it("throws when the payment exceeds the remaining amount", () => {
      expect(() => applyDebtPayment(1000, 900, 200)).toThrow(
        "قيمة السداد أكبر من المتبقي على المديونية",
      );
    });
  });

  describe("centsToMoneyString", () => {
    it("formats cents as a fixed two-decimal money string", () => {
      expect(centsToMoneyString(12345)).toBe("123.45");
    });
  });
});
