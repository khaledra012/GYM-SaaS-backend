const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_TIMEZONE = process.env.APP_DEFAULT_TIMEZONE || "Africa/Cairo";
const LEGACY_UTC_TIMEZONES = new Set(["UTC", "Etc/UTC"]);

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
};

const extractParts = (date: Date, timeZone: string) => {
  const parts = getFormatter(timeZone).formatToParts(date);

  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
};

const pad2 = (value: number): string => value.toString().padStart(2, "0");

const parseDateOnly = (dateOnly: string) => {
  if (!ISO_DATE_ONLY_REGEX.test(dateOnly)) {
    throw new Error("صيغة التاريخ يجب أن تكون YYYY-MM-DD");
  }

  const [year, month, day] = dateOnly.split("-").map(Number);
  return { year, month, day };
};

const getOffsetMilliseconds = (date: Date, timeZone: string): number => {
  const { year, month, day, hour, minute, second } = extractParts(date, timeZone);
  const utcFromLocalWallClock = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    0,
  );

  return utcFromLocalWallClock - date.getTime();
};

export const isValidTimezone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const normalizeTimezone = (timeZone?: string | null): string => {
  // Keep behavior aligned with Egypt timezone for legacy UTC centers.
  if (timeZone && LEGACY_UTC_TIMEZONES.has(timeZone)) {
    return isValidTimezone(DEFAULT_TIMEZONE) ? DEFAULT_TIMEZONE : "Africa/Cairo";
  }

  if (timeZone && isValidTimezone(timeZone)) {
    return timeZone;
  }

  if (isValidTimezone(DEFAULT_TIMEZONE)) {
    return DEFAULT_TIMEZONE;
  }

  return "Africa/Cairo";
};

export const getDateOnlyInTimezone = (
  date: Date,
  timeZone?: string | null,
): string => {
  const tz = normalizeTimezone(timeZone);
  const { year, month, day } = extractParts(date, tz);
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

export const getCurrentDateOnlyInTimezone = (timeZone?: string | null): string => {
  return getDateOnlyInTimezone(new Date(), timeZone);
};

export const addDaysToDateOnly = (dateOnly: string, days: number): string => {
  const { year, month, day } = parseDateOnly(dateOnly);

  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);

  return `${utcDate.getUTCFullYear()}-${pad2(utcDate.getUTCMonth() + 1)}-${pad2(utcDate.getUTCDate())}`;
};

export const dateOnlyToUtcStartOfDay = (
  dateOnly: string,
  timeZone?: string | null,
): Date => {
  const tz = normalizeTimezone(timeZone);
  const { year, month, day } = parseDateOnly(dateOnly);

  const localWallClockUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let utcTimestamp = localWallClockUtc;

  // Usually converges in one iteration; second pass handles DST edge cases.
  for (let i = 0; i < 3; i += 1) {
    const offset = getOffsetMilliseconds(new Date(utcTimestamp), tz);
    const nextUtc = localWallClockUtc - offset;
    if (nextUtc === utcTimestamp) break;
    utcTimestamp = nextUtc;
  }

  return new Date(utcTimestamp);
};
