const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

const normalizeStringMoney = (value: string): string => {
  const raw = value.trim();
  if (!MONEY_PATTERN.test(raw)) {
    throw new Error("صيغة المبلغ غير صحيحة");
  }

  const isNegative = raw.startsWith("-");
  const unsigned = isNegative ? raw.slice(1) : raw;
  const [intPartRaw, decimalPartRaw = ""] = unsigned.split(".");

  const normalizedInteger = String(BigInt(intPartRaw));
  const normalizedDecimal = decimalPartRaw.padEnd(2, "0").slice(0, 2);

  if (normalizedInteger === "0" && normalizedDecimal === "00") {
    return "0.00";
  }

  const signedPrefix = isNegative ? "-" : "";
  return `${signedPrefix}${normalizedInteger}.${normalizedDecimal}`;
};

export const toMoneyString = (value: string | number): string => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("قيمة المبلغ غير صالحة");
    }

    const fixed = value.toFixed(2);
    return normalizeStringMoney(fixed);
  }

  return normalizeStringMoney(value);
};

export const moneyToCents = (value: string | number): bigint => {
  const normalized = toMoneyString(value);
  const isNegative = normalized.startsWith("-");
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [intPart, decimalPart] = unsigned.split(".");

  const cents = BigInt(intPart) * 100n + BigInt(decimalPart);
  return isNegative ? -cents : cents;
};

export const centsToMoneyString = (cents: bigint): string => {
  const isNegative = cents < 0;
  const absolute = isNegative ? -cents : cents;

  const intPart = absolute / 100n;
  const decimalPart = absolute % 100n;
  const normalized = `${intPart.toString()}.${decimalPart.toString().padStart(2, "0")}`;

  if (normalized === "0.00") {
    return normalized;
  }

  return isNegative ? `-${normalized}` : normalized;
};
