import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const containsArabic = (value: unknown): boolean =>
  typeof value === "string" && /[\u0600-\u06FF]/.test(value);

const toArabicStatus = (statusCode: number): "فشل" | "خطأ" =>
  statusCode >= 400 && statusCode < 500 ? "فشل" : "خطأ";

const resolveSequelizeDatabaseError = (
  rawMessage: string,
): { statusCode: number; message: string } => {
  if (/Unknown column/i.test(rawMessage)) {
    return {
      statusCode: 500,
      message:
        "يوجد عدم توافق بين الكود وبنية قاعدة البيانات. تأكد من تشغيل آخر مايجريشن.",
    };
  }

  if (/Too many keys specified/i.test(rawMessage)) {
    return {
      statusCode: 500,
      message: "عدد الفهارس في الجدول تجاوز الحد المسموح في قاعدة البيانات.",
    };
  }

  const nullColumnMatch = rawMessage.match(/Column '([^']+)' cannot be null/i);
  if (nullColumnMatch) {
    return {
      statusCode: 400,
      message: `الحقل ${nullColumnMatch[1]} مطلوب ولا يمكن أن يكون فارغًا.`,
    };
  }

  const tooLongMatch = rawMessage.match(/Data too long for column '([^']+)'/i);
  if (tooLongMatch) {
    return {
      statusCode: 400,
      message: `القيمة المدخلة أطول من المسموح للحقل ${tooLongMatch[1]}.`,
    };
  }

  const outOfRangeMatch = rawMessage.match(/Out of range value for column '([^']+)'/i);
  if (outOfRangeMatch) {
    return {
      statusCode: 400,
      message: `القيمة المدخلة خارج النطاق المسموح للحقل ${outOfRangeMatch[1]}.`,
    };
  }

  if (/Incorrect integer value/i.test(rawMessage)) {
    return {
      statusCode: 400,
      message: "تم إرسال قيمة رقمية غير صحيحة.",
    };
  }

  if (/Incorrect datetime value|Incorrect date value/i.test(rawMessage)) {
    return {
      statusCode: 400,
      message: "تم إرسال تاريخ أو وقت غير صالح.",
    };
  }

  return {
    statusCode: 500,
    message: "حدث خطأ في قاعدة البيانات.",
  };
};

export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const originalMessage = typeof err?.message === "string" ? err.message : "";

  err.statusCode =
    typeof err?.statusCode === "number" && Number.isFinite(err.statusCode)
      ? err.statusCode
      : 500;
  err.status = containsArabic(err?.status)
    ? err.status
    : toArabicStatus(err.statusCode);

  if (err.name === "JsonWebTokenError") {
    err.statusCode = 401;
    err.status = "فشل";
    err.message = "التوكن غير صالح أو تم التلاعب به، الرجاء تسجيل الدخول";
  } else if (err.name === "TokenExpiredError") {
    err.statusCode = 401;
    err.status = "فشل";
    err.message = "انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجددًا";
  } else if (err.name === "NotBeforeError") {
    err.statusCode = 401;
    err.status = "فشل";
    err.message = "هذا التوكن غير نشط بعد";
  }

  if (err.name === "SequelizeValidationError") {
    err.statusCode = 400;
    err.status = "فشل";
    err.message =
      err.errors?.map((e: any) => e.message).join("، ") ||
      "البيانات المرسلة غير صحيحة.";
  } else if (err.name === "SequelizeUniqueConstraintError") {
    err.statusCode = 409;
    err.status = "فشل";
    err.message = "هذا العنصر موجود بالفعل.";
  } else if (err.name === "SequelizeOptimisticLockError") {
    err.statusCode = 409;
    err.status = "فشل";
    err.message = "تم تعديل البيانات بواسطة مستخدم آخر. حدّث الصفحة وحاول مرة أخرى.";
  } else if (err.name === "SequelizeForeignKeyConstraintError") {
    err.statusCode = 400;
    err.status = "فشل";
    err.message = "القيمة المرجعية غير موجودة أو لا يمكن استخدامها.";
  } else if (err.name === "SequelizeDatabaseError") {
    const resolved = resolveSequelizeDatabaseError(
      err.original?.message || err.parent?.message || err.message || "",
    );
    err.statusCode = resolved.statusCode;
    err.status = toArabicStatus(err.statusCode);
    err.message = resolved.message;
  } else if (
    err.name === "SequelizeConnectionError" ||
    err.name === "SequelizeConnectionRefusedError" ||
    err.name === "SequelizeHostNotFoundError" ||
    err.name === "SequelizeHostNotReachableError" ||
    err.name === "SequelizeInvalidConnectionError" ||
    err.name === "SequelizeConnectionTimedOutError"
  ) {
    err.statusCode = 503;
    err.status = "خطأ";
    err.message = "تعذر الاتصال بقاعدة البيانات حاليًا. حاول مرة أخرى لاحقًا.";
  }

  if (err.type === "entity.parse.failed") {
    err.statusCode = 400;
    err.status = "فشل";
    err.message = "صيغة JSON غير صحيحة.";
  }

  if (!containsArabic(err.message)) {
    err.message =
      err.statusCode >= 500
        ? "حدث خطأ غير متوقع في الخادم."
        : "البيانات المرسلة غير صحيحة.";
  }

  logger.error(err.message, {
    statusCode: err.statusCode,
    originalError:
      process.env.NODE_ENV === "development" && originalMessage
        ? originalMessage
        : undefined,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

