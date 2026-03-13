import { DebtValidation } from "./debt.schema";

describe("DebtValidation", () => {
  it("accepts a valid manual debt payload", () => {
    const result = DebtValidation.createDebt.safeParse({
      body: {
        memberId: 12,
        title: "تيشيرت جيم",
        note: "تم الاستلام",
        amountCents: 25000,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects zero payment amounts", () => {
    const result = DebtValidation.createPayment.safeParse({
      params: { id: 1 },
      body: {
        amountCents: 0,
        type: "cash",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid date ranges in list queries", () => {
    const result = DebtValidation.listDebts.safeParse({
      query: {
        page: 1,
        limit: 20,
        startDate: "2026-03-10",
        endDate: "2026-03-01",
      },
    });

    expect(result.success).toBe(false);
  });
});
