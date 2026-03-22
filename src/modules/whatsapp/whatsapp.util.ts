import {
  IClassifiedWhatsAppFailure,
  WhatsAppFailureType,
} from "./whatsapp.types";

const SIMPLE_SPINTAX_REGEX = /\{([^{}]+)\}/;
const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const RETRYABLE_FAILURE_CODES = new Set([
  "timeout",
  "connection_closed",
  "session_unavailable",
  "module_paused",
  "session_paused",
  "temporary_unavailable",
]);

const FATAL_FAILURE_CODES = new Set([
  "invalid_phone",
  "recipient_not_registered",
  "invalid_payload",
  "attachment_missing",
]);

export const renderWhatsAppTemplate = (
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string =>
  template.replace(PLACEHOLDER_REGEX, (_match, key: string) => {
    const value = variables[key];
    if (value === null || value === undefined) {
      return "";
    }

    return String(value);
  });

export const applySpintax = (
  template: string,
  randomFn: () => number = Math.random,
): string => {
  let result = template;
  let safetyCounter = 0;

  while (SIMPLE_SPINTAX_REGEX.test(result) && safetyCounter < 20) {
    result = result.replace(SIMPLE_SPINTAX_REGEX, (_full, group: string) => {
      const options = group
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);

      if (options.length === 0) {
        return "";
      }

      const index = Math.min(
        options.length - 1,
        Math.floor(randomFn() * options.length),
      );

      return options[index];
    });

    safetyCounter += 1;
  }

  return result;
};

export const renderAndSpinWhatsAppTemplate = (
  template: string,
  variables: Record<string, string | number | null | undefined>,
  randomFn?: () => number,
): string => applySpintax(renderWhatsAppTemplate(template, variables), randomFn);

export const normalizeWhatsAppPhone = (
  input: string,
  defaultCountryCode = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "20").trim(),
): string | null => {
  const digits = input.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  let normalized = digits;

  if (normalized.startsWith("00")) {
    normalized = normalized.slice(2);
  }

  if (normalized.startsWith("0") && defaultCountryCode) {
    normalized = `${defaultCountryCode}${normalized.slice(1)}`;
  }

  if (normalized.length < 10 || normalized.length > 15) {
    return null;
  }

  return normalized;
};

export const toWhatsAppJid = (phone: string): string | null => {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) {
    return null;
  }

  return `${normalized}@s.whatsapp.net`;
};

export const getRetryDelayMinutes = (attempt: number): number => {
  if (attempt <= 1) return 1;
  if (attempt === 2) return 5;
  return 15;
};

export const getRetryDelayMs = (attempt: number): number =>
  getRetryDelayMinutes(attempt) * 60 * 1000;

export const getRandomizedDispatchGapMs = (
  randomFn: () => number = Math.random,
  minSeconds = 20,
  maxSeconds = 60,
): number => {
  const minimum = Math.max(1, Math.floor(minSeconds));
  const maximum = Math.max(minimum, Math.floor(maxSeconds));
  const spread = maximum - minimum + 1;
  const offset = Math.min(spread - 1, Math.floor(randomFn() * spread));
  return (minimum + offset) * 1000;
};

export const buildSequentialDispatchTimes = (
  count: number,
  startAt: Date = new Date(),
  randomFn: () => number = Math.random,
  minSeconds = 20,
  maxSeconds = 60,
): Date[] => {
  const times: Date[] = [];
  let cursor = startAt.getTime();

  for (let index = 0; index < count; index += 1) {
    cursor += getRandomizedDispatchGapMs(randomFn, minSeconds, maxSeconds);
    times.push(new Date(cursor));
  }

  return times;
};

export const shouldPauseGlobalModule = (input: {
  totalAttempts: number;
  failedAttempts: number;
  minAttempts?: number;
  threshold?: number;
}): boolean => {
  const minAttempts = input.minAttempts ?? 10;
  const threshold = input.threshold ?? 0.5;

  if (input.totalAttempts < minAttempts || input.totalAttempts <= 0) {
    return false;
  }

  return input.failedAttempts / input.totalAttempts > threshold;
};

export const shouldMarkSessionDegraded = (input: {
  totalAttempts: number;
  failedAttempts: number;
  minAttempts?: number;
  threshold?: number;
}): boolean => {
  const minAttempts = input.minAttempts ?? 5;
  const threshold = input.threshold ?? 0.5;

  if (input.totalAttempts < minAttempts || input.totalAttempts <= 0) {
    return false;
  }

  return input.failedAttempts / input.totalAttempts > threshold;
};

const buildFailure = (
  failureType: WhatsAppFailureType,
  failureCode: string,
  failureReason: string,
): IClassifiedWhatsAppFailure => ({
  failureType,
  failureCode,
  failureReason,
});

export const classifyWhatsAppFailure = (
  error: unknown,
): IClassifiedWhatsAppFailure => {
  const failureCode = String((error as any)?.code ?? "").trim().toLowerCase();
  const message = String((error as any)?.message ?? error ?? "")
    .trim()
    .toLowerCase();

  if (
    FATAL_FAILURE_CODES.has(failureCode) ||
    message.includes("does not have whatsapp") ||
    message.includes("not on whatsapp") ||
    message.includes("invalid jid") ||
    message.includes("invalid phone") ||
    message.includes("attachment missing") ||
    message.includes("file not found")
  ) {
    return buildFailure(
      "fatal",
      failureCode || "invalid_phone",
      "تعذر إرسال الرسالة لأن رقم الهاتف غير صالح أو لا يملك واتساب",
    );
  }

  if (
    RETRYABLE_FAILURE_CODES.has(failureCode) ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("connection closed") ||
    message.includes("not connected") ||
    message.includes("session unavailable")
  ) {
    return buildFailure(
      "retryable",
      failureCode || "temporary_unavailable",
      "تعذر إرسال الرسالة حاليًا وسيتم إعادة المحاولة لاحقًا",
    );
  }

  if (message.includes("module paused")) {
    return buildFailure(
      "retryable",
      "module_paused",
      "تم إيقاف موديول الواتساب مؤقتًا لحين استقرار الجلسات",
    );
  }

  if (message.includes("session paused")) {
    return buildFailure(
      "retryable",
      "session_paused",
      "جلسة الواتساب موقوفة مؤقتًا وسيتم إعادة المحاولة لاحقًا",
    );
  }

  return buildFailure(
    "retryable",
    failureCode || "unknown_retryable",
    "تعذر إرسال الرسالة حاليًا وسيتم إعادة المحاولة لاحقًا",
  );
};
