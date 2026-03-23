import fs from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { IAiPlanPayload } from "./ai-plan.schema";
import { sanitizeFileNameSegment } from "./ai-plan.util";

interface IGenerateAiPlanPdfInput {
  planId: number;
  centerId: number;
  centerName: string;
  memberName: string;
  memberCode: string;
  goal: string;
  planType: string;
  payload: IAiPlanPayload;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const TOP_MARGIN = 70;
const BOTTOM_MARGIN = 52;
const LINE_GAP = 6;
const FONT_SIZE_BODY = 11;
const FONT_SIZE_TITLE = 18;
const FONT_SIZE_SECTION = 14;

export class AiPlanPdfService {
  private cachedArabicFontBytes: Uint8Array | null = null;
  private cachedLatinFontBytes: Uint8Array | null = null;

  private getStorageRoot(): string {
    const configured = String(process.env.AI_PLAN_STORAGE_DIR ?? "").trim();
    if (configured) {
      return path.resolve(configured);
    }

    return path.join(process.cwd(), "storage", "ai-plans");
  }

  private async getArabicFontBytes(): Promise<Uint8Array> {
    if (this.cachedArabicFontBytes) {
      return this.cachedArabicFontBytes;
    }

    const fontPath = path.join(
      process.cwd(),
      "node_modules",
      "@fontsource",
      "cairo",
      "files",
      "cairo-arabic-400-normal.woff",
    );

    this.cachedArabicFontBytes = await fs.readFile(fontPath);
    return this.cachedArabicFontBytes;
  }

  private async getLatinFontBytes(): Promise<Uint8Array> {
    if (this.cachedLatinFontBytes) {
      return this.cachedLatinFontBytes;
    }

    const fontPath = path.join(
      process.cwd(),
      "node_modules",
      "@fontsource",
      "cairo",
      "files",
      "cairo-latin-400-normal.woff",
    );

    this.cachedLatinFontBytes = await fs.readFile(fontPath);
    return this.cachedLatinFontBytes;
  }

  private isArabicCharacter(char: string): boolean {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
      char,
    );
  }

  private splitTextRuns(text: string): Array<{ text: string; fontType: "arabic" | "latin" }> {
    const runs: Array<{ text: string; fontType: "arabic" | "latin" }> = [];

    for (const char of text) {
      const isWhitespace = /\s/.test(char);
      const fontType: "arabic" | "latin" = this.isArabicCharacter(char)
        ? "arabic"
        : "latin";

      const previousRun = runs[runs.length - 1];
      if (
        previousRun &&
        (previousRun.fontType === fontType || isWhitespace)
      ) {
        previousRun.text += char;
        continue;
      }

      runs.push({
        text: char,
        fontType: previousRun && isWhitespace ? previousRun.fontType : fontType,
      });
    }

    return runs;
  }

  private getVisualTextRuns(
    text: string,
  ): Array<{ text: string; fontType: "arabic" | "latin" }> {
    const runs = this.splitTextRuns(text);
    const hasArabic = runs.some((run) => run.fontType === "arabic");
    const hasLatin = runs.some(
      (run) => run.fontType === "latin" && /[A-Za-z0-9]/.test(run.text),
    );

    if (hasArabic && hasLatin && runs.length > 1) {
      return [...runs].reverse();
    }

    return runs;
  }

  private getPlanTypeLabel(planType: string): string {
    switch (planType) {
      case "workout_only":
        return "تمرين فقط";
      case "nutrition_only":
        return "غذاء فقط";
      case "combined":
        return "تمرين + غذاء";
      default:
        return planType.replace(/_/g, " ");
    }
  }

  private getGoalLabel(goal: string): string {
    const normalizedGoal = goal.trim().toLowerCase();

    switch (normalizedGoal) {
      case "fat_loss":
        return "خسارة دهون";
      case "muscle_gain":
        return "زيادة كتلة عضلية";
      case "maintenance":
        return "ثبات";
      case "body_recomp":
        return "إعادة تشكيل الجسم";
      case "strength":
        return "زيادة القوة";
      default:
        return goal.replace(/_/g, " ");
    }
  }

  private getTextWidth(
    text: string,
    fonts: { arabic: any; latin: any },
    fontSize: number,
  ): number {
    return this.splitTextRuns(text).reduce((total, run) => {
      const font = run.fontType === "arabic" ? fonts.arabic : fonts.latin;
      return total + font.widthOfTextAtSize(run.text, fontSize);
    }, 0);
  }

  private wrapText(
    text: string,
    fonts: { arabic: any; latin: any },
    fontSize: number,
    maxWidth: number,
  ): string[] {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return [];
    }

    const words = normalizedText.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const candidateWidth = this.getTextWidth(candidate, fonts, fontSize);

      if (candidateWidth <= maxWidth || !currentLine) {
        currentLine = candidate;
        continue;
      }

      lines.push(currentLine);
      currentLine = word;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  public async generate(input: IGenerateAiPlanPdfInput): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const [arabicFontBytes, latinFontBytes] = await Promise.all([
      this.getArabicFontBytes(),
      this.getLatinFontBytes(),
    ]);
    const arabicFont = await pdfDoc.embedFont(arabicFontBytes, { subset: true });
    const latinFont = await pdfDoc.embedFont(latinFontBytes, { subset: true });
    const fonts = {
      arabic: arabicFont,
      latin: latinFont,
    };

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - TOP_MARGIN;

    const maxWidth = PAGE_WIDTH - MARGIN_X * 2;

    const ensureSpace = (estimatedHeight: number) => {
      if (cursorY - estimatedHeight >= BOTTOM_MARGIN) {
        return;
      }

      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - TOP_MARGIN;
    };

    const drawParagraph = (
      text: string,
      fontSize = FONT_SIZE_BODY,
      color = rgb(0.1, 0.1, 0.1),
    ) => {
      const lines = this.wrapText(text, fonts, fontSize, maxWidth);
      if (lines.length === 0) {
        return;
      }

      const lineHeight = fontSize + LINE_GAP;
      ensureSpace(lines.length * lineHeight + 10);

      for (const line of lines) {
        const lineWidth = this.getTextWidth(line, fonts, fontSize);
        let cursorX = PAGE_WIDTH - MARGIN_X - lineWidth;

        for (const run of this.getVisualTextRuns(line)) {
          const font = run.fontType === "arabic" ? arabicFont : latinFont;
          page.drawText(run.text, {
            x: cursorX,
            y: cursorY,
            size: fontSize,
            font,
            color,
          });
          cursorX += font.widthOfTextAtSize(run.text, fontSize);
        }

        cursorY -= lineHeight;
      }

      cursorY -= 4;
    };

    const drawTextRuns = (
      text: string,
      startX: number,
      y: number,
      fontSize: number,
      color = rgb(0.1, 0.1, 0.1),
    ) => {
      let cursorX = startX;

      for (const run of this.getVisualTextRuns(text)) {
        const font = run.fontType === "arabic" ? arabicFont : latinFont;
        page.drawText(run.text, {
          x: cursorX,
          y,
          size: fontSize,
          font,
          color,
        });
        cursorX += font.widthOfTextAtSize(run.text, fontSize);
      }
    };

    const drawLabeledValue = (
      label: string,
      value: string,
      fontSize = FONT_SIZE_BODY,
      color = rgb(0.1, 0.1, 0.1),
    ) => {
      const normalizedValue = String(value ?? "").trim() || "-";
      const labelText = `!${label}`;
      const labelWidth = this.getTextWidth(labelText, fonts, fontSize);
      const labelGap = 8;
      const valueMaxWidth = Math.max(80, maxWidth - labelWidth - labelGap);
      const valueLines = this.wrapText(
        normalizedValue,
        fonts,
        fontSize,
        valueMaxWidth,
      );
      const lines = valueLines.length > 0 ? valueLines : ["-"];
      const lineHeight = fontSize + LINE_GAP;

      ensureSpace(lines.length * lineHeight + 10);

      const labelX = PAGE_WIDTH - MARGIN_X - labelWidth;
      drawTextRuns(labelText, labelX, cursorY, fontSize, color);

      for (const line of lines) {
        const lineWidth = this.getTextWidth(line, fonts, fontSize);
        const valueX = labelX - labelGap - lineWidth;
        drawTextRuns(line, valueX, cursorY, fontSize, color);
        cursorY -= lineHeight;
      }

      cursorY -= 4;
    };

    const drawSectionTitle = (text: string) => {
      ensureSpace(FONT_SIZE_SECTION + 20);
      const titleWidth = this.getTextWidth(text, fonts, FONT_SIZE_SECTION);
      let cursorX = PAGE_WIDTH - MARGIN_X - titleWidth;

      for (const run of this.getVisualTextRuns(text)) {
        const font = run.fontType === "arabic" ? arabicFont : latinFont;
        page.drawText(run.text, {
          x: cursorX,
          y: cursorY,
          size: FONT_SIZE_SECTION,
          font,
          color: rgb(0.06, 0.28, 0.63),
        });
        cursorX += font.widthOfTextAtSize(run.text, FONT_SIZE_SECTION);
      }

      cursorY -= FONT_SIZE_SECTION + 10;
    };

    {
      const title = "الخطة المعتمدة";
      const titleWidth = this.getTextWidth(title, fonts, FONT_SIZE_TITLE);
      let cursorX = PAGE_WIDTH - MARGIN_X - titleWidth;

      for (const run of this.getVisualTextRuns(title)) {
        const font = run.fontType === "arabic" ? arabicFont : latinFont;
        page.drawText(run.text, {
          x: cursorX,
          y: cursorY,
          size: FONT_SIZE_TITLE,
          font,
          color: rgb(0.03, 0.2, 0.42),
        });
        cursorX += font.widthOfTextAtSize(run.text, FONT_SIZE_TITLE);
      }
    }
    cursorY -= FONT_SIZE_TITLE + 14;

    drawLabeledValue(":اسم الجيم", input.centerName);
    drawLabeledValue("اسم العضو", input.memberName);
    drawLabeledValue("كود العضو", input.memberCode);
    drawLabeledValue("نوع الخطة", this.getPlanTypeLabel(input.planType));
    drawLabeledValue("الهدف", this.getGoalLabel(input.goal));

    drawSectionTitle("ملخص الخطة");
    drawParagraph(input.payload.summary);

    if (input.payload.dailyCalories !== null && input.payload.dailyCalories !== undefined) {
      drawSectionTitle("السعرات والمغذيات");
      drawLabeledValue(
        "السعرات اليومية المقترحة",
        String(input.payload.dailyCalories),
      );
      if (input.payload.macros) {
        drawParagraph(
          `بروتين: ${input.payload.macros.proteinGrams} جم - كارب: ${input.payload.macros.carbsGrams} جم - دهون: ${input.payload.macros.fatsGrams} جم`,
        );
      }
    }

    if (input.payload.workoutPlan.length > 0) {
      drawSectionTitle("برنامج التمرين");
      for (const day of input.payload.workoutPlan) {
        drawParagraph(`${day.dayLabel} - ${day.focus}`);
        for (const exercise of day.exercises) {
          drawParagraph(
            `- ${exercise.name} | المجموعات: ${exercise.sets} | التكرارات: ${exercise.reps}${exercise.restSeconds ? ` | راحة: ${exercise.restSeconds} ثانية` : ""}`,
            10,
          );
          if (exercise.notes) {
            drawParagraph(`ملاحظة: ${exercise.notes}`, 10);
          }
        }
        if (day.notes) {
          drawParagraph(`ملاحظات اليوم: ${day.notes}`, 10);
        }
      }
    }

    if (input.payload.nutritionPlan.length > 0) {
      drawSectionTitle("النظام الغذائي");
      for (const meal of input.payload.nutritionPlan) {
        drawParagraph(`${meal.title}${meal.time ? ` - ${meal.time}` : ""}`);
        drawParagraph(`المكونات: ${meal.items.join(" - ")}`, 10);
        if (meal.notes) {
          drawParagraph(`ملاحظات الوجبة: ${meal.notes}`, 10);
        }
      }
    }

    if (input.payload.memberInstructions.length > 0) {
      drawSectionTitle("تعليمات للعضو");
      for (const item of input.payload.memberInstructions) {
        drawParagraph(`- ${item}`);
      }
    }

    if (input.payload.coachNotes.length > 0) {
      drawSectionTitle("ملاحظات الكوتش");
      for (const item of input.payload.coachNotes) {
        drawParagraph(`- ${item}`);
      }
    }

    if (input.payload.warnings.length > 0) {
      drawSectionTitle("تحذيرات");
      for (const item of input.payload.warnings) {
        drawParagraph(`- ${item}`, FONT_SIZE_BODY, rgb(0.62, 0.15, 0.12));
      }
    }

    drawSectionTitle("تنبيه");
    drawParagraph(
      "هذه الخطة مقترح عام وتم اعتمادها من الكوتش، وتحتاج مراجعة مختص في الحالات الصحية الخاصة.",
      10,
      rgb(0.35, 0.1, 0.1),
    );

    const rootDirectory = this.getStorageRoot();
    const memberSegment = sanitizeFileNameSegment(input.memberName);
    const fileName = `plan-${input.planId}-${memberSegment || "member"}.pdf`;
    const fileDirectory = path.join(rootDirectory, String(input.centerId));
    const filePath = path.join(fileDirectory, fileName);

    await fs.mkdir(fileDirectory, { recursive: true });
    await fs.writeFile(filePath, await pdfDoc.save());

    return filePath;
  }
}

export const aiPlanPdfService = new AiPlanPdfService();

