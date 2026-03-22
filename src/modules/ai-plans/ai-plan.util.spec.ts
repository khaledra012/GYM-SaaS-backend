import {
  buildAiPlanRiskFlags,
  extractJsonPayload,
  sanitizeFileNameSegment,
} from "./ai-plan.util";

describe("ai-plan.util", () => {
  it("extracts JSON from fenced Gemini responses", () => {
    const result = extractJsonPayload('```json\n{"summary":"ok"}\n```');
    expect(result).toBe('{"summary":"ok"}');
  });

  it("builds risk flags for underage and medical review", () => {
    const flags = buildAiPlanRiskFlags({
      memberId: 1,
      planType: "combined",
      goal: "fat_loss",
      age: 17,
      gender: "male",
      weightKg: 70,
      heightCm: 175,
      activityLevel: "moderate",
      trainingDaysPerWeek: 4,
      medicalConditions: ["سكر"],
      injuries: [],
    });

    expect(flags).toContain("under_18");
    expect(flags).toContain("medical_review_required");
  });

  it("sanitizes file name segments safely", () => {
    expect(sanitizeFileNameSegment('  plan: khaled / test  ')).toBe("plan-khaled-test");
  });
});
