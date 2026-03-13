import { debtService } from "./debt.service";

describe("DebtService", () => {
  it("builds the correct automatic debt title for subscription creation", () => {
    expect(
      debtService.buildAutomatedSubscriptionDebtTitle({
        action: "create",
        subscriptionId: 101,
      }),
    ).toBe("مديونية اشتراك #101");
  });

  it("builds the correct automatic debt title for expired renewals", () => {
    expect(
      debtService.buildAutomatedSubscriptionDebtTitle({
        action: "renew_expired",
        subscriptionId: 42,
      }),
    ).toBe("مديونية تجديد اشتراك منتهي #42");
  });

  it("builds a readable automatic debt note", () => {
    expect(
      debtService.buildAutomatedSubscriptionDebtNote({
        totalPriceCents: 100000,
        pricePaidCents: 40000,
      }),
    ).toContain("1000.00");
  });
});
