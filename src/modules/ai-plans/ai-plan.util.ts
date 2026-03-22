export interface IAiPlanGenerationInputSnapshot {
  memberId: number;
  planType: "workout_only" | "nutrition_only" | "combined";
  goal: string;
  age: number;
  gender: "male" | "female";
  weightKg: number;
  heightCm: number;
  activityLevel: string;
  trainingDaysPerWeek: number;
  experienceLevel?: string | null;
  sessionDurationMinutes?: number | null;
  mealsPerDay?: number | null;
  foodPreferences?: string[];
  foodRestrictions?: string[];
  medicalConditions?: string[];
  injuries?: string[];
  notes?: string | null;
}

const MEDICAL_WARNING_KEYWORDS = [
  "diabetes",
  "kidney",
  "renal",
  "heart",
  "cardiac",
  "pressure",
  "hypertension",
  "pregnant",
  "pregnancy",
  "سكر",
  "ضغط",
  "كلى",
  "قلب",
  "حمل",
];

export const extractJsonPayload = (rawText: string): string => {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return trimmed;
};

export const buildAiPlanRiskFlags = (
  input: IAiPlanGenerationInputSnapshot,
): string[] => {
  const flags = new Set<string>();

  if (input.age < 18) {
    flags.add("under_18");
  }

  const combinedMedicalText = [
    ...(input.medicalConditions ?? []),
    ...(input.injuries ?? []),
    input.notes ?? "",
  ]
    .join(" ")
    .toLowerCase();

  for (const keyword of MEDICAL_WARNING_KEYWORDS) {
    if (combinedMedicalText.includes(keyword)) {
      flags.add("medical_review_required");
      break;
    }
  }

  return Array.from(flags);
};

export const sanitizeFileNameSegment = (value: string): string =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "plan";
