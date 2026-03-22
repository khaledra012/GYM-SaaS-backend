import { AppError } from "../../shared";
import { IAiPlanPayload, AiPlanPayloadSchema, IGenerateAiPlanDTO } from "./ai-plan.schema";
import { extractJsonPayload } from "./ai-plan.util";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

export class AiPlanGeminiService {
  private getApiKey(): string {
    const apiKey = String(process.env.GEMINI_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new AppError("مفتاح Gemini API غير مضبوط على الخادم", 500);
    }

    return apiKey;
  }

  private buildPrompt(centerName: string, memberName: string, input: IGenerateAiPlanDTO): string {
    const medicalConditions = (input.medicalConditions ?? []).join(", ") || "لا يوجد";
    const injuries = (input.injuries ?? []).join(", ") || "لا يوجد";
    const foodPreferences = (input.foodPreferences ?? []).join(", ") || "لا يوجد";
    const foodRestrictions = (input.foodRestrictions ?? []).join(", ") || "لا يوجد";
    const notes = input.notes?.trim() || "لا توجد";

    return `
أنت مساعد محترف للكوتش داخل نظام إدارة جيم اسمه "${centerName}".
المطلوب: إنشاء مسودة خطة أولية للعضو "${memberName}".
هذه الخطة ليست نهائية ويجب أن تكون محافظة وآمنة ومناسبة للمراجعة البشرية.

بيانات العضو:
- نوع الخطة: ${input.planType}
- الهدف: ${input.goal}
- العمر: ${input.age}
- النوع: ${input.gender}
- الوزن بالكيلو: ${input.weightKg}
- الطول بالسنتيمتر: ${input.heightCm}
- مستوى النشاط: ${input.activityLevel}
- أيام التمرين أسبوعيًا: ${input.trainingDaysPerWeek}
- مستوى الخبرة: ${input.experienceLevel ?? "غير محدد"}
- مدة الحصة بالدقائق: ${input.sessionDurationMinutes ?? "غير محدد"}
- عدد الوجبات: ${input.mealsPerDay ?? "غير محدد"}
- تفضيلات الطعام: ${foodPreferences}
- القيود الغذائية: ${foodRestrictions}
- الحالات الطبية: ${medicalConditions}
- الإصابات: ${injuries}
- ملاحظات إضافية: ${notes}

قواعد إلزامية:
1) أعد النتيجة JSON فقط بدون Markdown أو شروحات خارجية.
2) اكتب كل النصوص بالعربية المبسطة.
3) لو نوع الخطة workout_only فاجعل nutritionPlan فارغًا.
4) لو نوع الخطة nutrition_only فاجعل workoutPlan فارغًا.
5) أضف warnings واضحة عند وجود أي حالة صحية أو إصابة أو سن أقل من 18.
6) لا تضع أي وعود علاجية أو تشخيص طبي.
7) الخطة يجب أن تكون مبدئية ومحافظة وليست عدوانية.

صيغة JSON المطلوبة:
{
  "summary": "string",
  "dailyCalories": 0,
  "macros": {
    "proteinGrams": 0,
    "carbsGrams": 0,
    "fatsGrams": 0
  },
  "workoutPlan": [
    {
      "dayLabel": "اليوم 1",
      "focus": "string",
      "exercises": [
        {
          "name": "string",
          "sets": "string",
          "reps": "string",
          "restSeconds": 60,
          "notes": "string"
        }
      ],
      "notes": "string"
    }
  ],
  "nutritionPlan": [
    {
      "title": "وجبة 1",
      "time": "string",
      "items": ["string"],
      "notes": "string"
    }
  ],
  "coachNotes": ["string"],
  "memberInstructions": ["string"],
  "warnings": ["string"]
}
    `.trim();
  }

  public async generatePlan(
    centerName: string,
    memberName: string,
    input: IGenerateAiPlanDTO,
  ): Promise<IAiPlanPayload> {
    const apiKey = this.getApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
      apiKey,
    )}`;

    const response = await (globalThis as any).fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: this.buildPrompt(centerName, memberName, input),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(
        `تعذر توليد الخطة عبر Gemini API. ${errorBody || response.statusText}`,
        502,
      );
    }

    const result = await response.json();
    const rawText = String(
      result?.candidates?.[0]?.content?.parts?.[0]?.text ??
        result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ??
        "",
    ).trim();

    if (!rawText) {
      throw new AppError("Gemini API لم يرجع محتوى صالحًا للخطة", 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayload(rawText));
    } catch {
      throw new AppError("رد Gemini API لم يكن JSON صالحًا", 502);
    }

    const validated = AiPlanPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      throw new AppError("رد Gemini API لا يطابق هيكل الخطة المطلوب", 502);
    }

    return validated.data;
  }
}

export const aiPlanGeminiService = new AiPlanGeminiService();
