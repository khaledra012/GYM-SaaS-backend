import rateLimit from "express-rate-limit";

export class RateLimitMiddleware {
  // حماية عامة لكل مسارات الـ API
  public static globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    // Scanner endpoint له limiter خاص أعلى، فنستثنيه من الحد العام
    skip: (req) =>
      req.method === "POST" && req.originalUrl.startsWith("/api/v1/checkins"),
    message: {
      status: "فشل",
      message:
        "تم تجاوز الحد المسموح من الطلبات، الرجاء المحاولة بعد 15 دقيقة.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // حماية صارمة لتسجيل الدخول
  public static authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      status: "فشل",
      message: "محاولات تسجيل دخول خاطئة كثيرة، الرجاء الانتظار 15 دقيقة.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // حد أعلى للـ Scanner في check-in
  public static checkinScannerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
      status: "فشل",
      message:
        "تم تجاوز الحد المسموح لمحاولات تسجيل الدخول، الرجاء المحاولة بعد 15 دقيقة.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
