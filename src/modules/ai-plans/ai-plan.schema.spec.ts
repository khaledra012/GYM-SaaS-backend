import { AiPlanPayloadSchema, AiPlanValidation } from "./ai-plan.schema";

describe("AiPlanValidation", () => {
  it("accepts a valid generate payload", () => {
    const parsed = AiPlanValidation.generate.parse({
      body: {
        memberId: 4,
        planType: "combined",
        goal: "muscle_gain",
        age: 28,
        gender: "male",
        weightKg: 82,
        heightCm: 180,
        activityLevel: "moderate",
        trainingDaysPerWeek: 4,
      },
    });

    expect(parsed.body.memberId).toBe(4);
    expect(parsed.body.planType).toBe("combined");
  });

  it("accepts a valid plan payload structure", () => {
    const parsed = AiPlanPayloadSchema.parse({
      summary: "خطة مبدئية مناسبة للعضو.",
      dailyCalories: 2400,
      macros: {
        proteinGrams: 160,
        carbsGrams: 250,
        fatsGrams: 70,
      },
      workoutPlan: [],
      nutritionPlan: [],
      coachNotes: ["راجع استجابة العضو بعد أسبوعين"],
      memberInstructions: ["اشرب ماء بكفاية"],
      warnings: [],
    });

    expect(parsed.dailyCalories).toBe(2400);
    expect(parsed.macros?.proteinGrams).toBe(160);
  });

  it("rejects approving payload edits when summary is missing", () => {
    expect(() =>
      AiPlanValidation.update.parse({
        params: { id: 1 },
        body: {
          payload: {
            dailyCalories: 2000,
            workoutPlan: [],
            nutritionPlan: [],
            coachNotes: [],
            memberInstructions: [],
            warnings: [],
          },
        },
      }),
    ).toThrow();
  });
});
