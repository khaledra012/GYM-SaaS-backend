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
  private cachedFontBytes: Uint8Array | null = null;

  private getStorageRoot(): string {
    const configured = String(process.env.AI_PLAN_STORAGE_DIR ?? "").trim();
    if (configured) {
      return path.resolve(configured);
    }

    return path.join(process.cwd(), "storage", "ai-plans");
  }

  private async getFontBytes(): Promise<Uint8Array> {
    if (this.cachedFontBytes) {
      return this.cachedFontBytes;
    }

    const fontPath = path.join(
      process.cwd(),
      "node_modules",
      "@fontsource",
      "cairo",
      "files",
      "cairo-arabic-400-normal.woff",
    );

    this.cachedFontBytes = await fs.readFile(fontPath);
    return this.cachedFontBytes;
  }

  private wrapText(
    text: string,
    font: any,
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
      const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);

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

    const fontBytes = await this.getFontBytes();
    const font = await pdfDoc.embedFont(fontBytes, { subset: true });

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
      const lines = this.wrapText(text, font, fontSize, maxWidth);
      if (lines.length === 0) {
        return;
      }

      const lineHeight = fontSize + LINE_GAP;
      ensureSpace(lines.length * lineHeight + 10);

      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN_X,
          y: cursorY,
          size: fontSize,
          font,
          color,
        });
        cursorY -= lineHeight;
      }

      cursorY -= 4;
    };

    const drawSectionTitle = (text: string) => {
      ensureSpace(FONT_SIZE_SECTION + 20);
      page.drawText(text, {
        x: MARGIN_X,
        y: cursorY,
        size: FONT_SIZE_SECTION,
        font,
        color: rgb(0.06, 0.28, 0.63),
      });
      cursorY -= FONT_SIZE_SECTION + 10;
    };

    page.drawText("الخطة المعتمدة", {
      x: MARGIN_X,
      y: cursorY,
      size: FONT_SIZE_TITLE,
      font,
      color: rgb(0.03, 0.2, 0.42),
    });
    cursorY -= FONT_SIZE_TITLE + 14;

    drawParagraph(`اسم الجيم: ${input.centerName}`);
    drawParagraph(`اسم العضو: ${input.memberName}`);
    drawParagraph(`كود العضو: ${input.memberCode}`);
    drawParagraph(`نوع الخطة: ${input.planType}`);
    drawParagraph(`الهدف: ${input.goal}`);

    drawSectionTitle("ملخص الخطة");
    drawParagraph(input.payload.summary);

    if (input.payload.dailyCalories !== null && input.payload.dailyCalories !== undefined) {
      drawSectionTitle("السعرات والمغذيات");
      drawParagraph(`السعرات اليومية المقترحة: ${input.payload.dailyCalories}`);
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
            `• ${exercise.name} | المجموعات: ${exercise.sets} | التكرارات: ${exercise.reps}${exercise.restSeconds ? ` | راحة: ${exercise.restSeconds} ثانية` : ""}`,
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
        drawParagraph(`• ${item}`);
      }
    }

    if (input.payload.coachNotes.length > 0) {
      drawSectionTitle("ملاحظات الكوتش");
      for (const item of input.payload.coachNotes) {
        drawParagraph(`• ${item}`);
      }
    }

    if (input.payload.warnings.length > 0) {
      drawSectionTitle("تحذيرات");
      for (const item of input.payload.warnings) {
        drawParagraph(`• ${item}`, FONT_SIZE_BODY, rgb(0.62, 0.15, 0.12));
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
