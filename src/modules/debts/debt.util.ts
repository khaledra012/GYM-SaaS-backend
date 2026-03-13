import { DebtPaymentType, DebtStatus } from "./debt.types";

export interface IDebtAmountsSnapshot {
  paidAmountCents: number;
  remainingAmountCents: number;
  status: DebtStatus;
}

export const resolveDebtStatus = (
  paidAmountCents: number,
  remainingAmountCents: number,
): DebtStatus => {
  if (paidAmountCents <= 0) {
    return "unpaid";
  }

  if (remainingAmountCents <= 0) {
    return "paid";
  }

  return "partially_paid";
};

export const applyDebtPayment = (
  originalAmountCents: number,
  currentPaidAmountCents: number,
  paymentAmountCents: number,
): IDebtAmountsSnapshot => {
  if (!Number.isInteger(originalAmountCents) || originalAmountCents <= 0) {
    throw new Error("قيمة أصل المديونية غير صحيحة");
  }

  if (!Number.isInteger(currentPaidAmountCents) || currentPaidAmountCents < 0) {
    throw new Error("قيمة المسدد الحالية غير صحيحة");
  }

  if (!Number.isInteger(paymentAmountCents) || paymentAmountCents <= 0) {
    throw new Error("قيمة السداد يجب أن تكون أكبر من صفر");
  }

  const nextPaidAmountCents = currentPaidAmountCents + paymentAmountCents;
  if (nextPaidAmountCents > originalAmountCents) {
    throw new Error("قيمة السداد أكبر من المتبقي على المديونية");
  }

  const remainingAmountCents = originalAmountCents - nextPaidAmountCents;

  return {
    paidAmountCents: nextPaidAmountCents,
    remainingAmountCents,
    status: resolveDebtStatus(nextPaidAmountCents, remainingAmountCents),
  };
};

export const centsToMoneyString = (value: number): string => {
  if (!Number.isInteger(value)) {
    throw new Error("القيمة يجب أن تكون بالقرش كرقم صحيح");
  }

  const isNegative = value < 0;
  const absolute = Math.abs(value);
  const integerPart = Math.floor(absolute / 100);
  const decimalPart = String(absolute % 100).padStart(2, "0");
  const normalized = `${integerPart}.${decimalPart}`;

  return isNegative ? `-${normalized}` : normalized;
};

export const moneyStringToCents = (value: string): number => {
  const normalized = value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("صيغة المبلغ غير صحيحة");
  }

  const isNegative = normalized.startsWith("-");
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [integerPart, decimalPart = ""] = unsigned.split(".");
  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0"));

  return isNegative ? -cents : cents;
};

export const getDebtStatusLabel = (status: DebtStatus): string => {
  switch (status) {
    case "unpaid":
      return "غير مدفوعة";
    case "partially_paid":
      return "مدفوعة جزئيًا";
    case "paid":
      return "مسددة بالكامل";
    default:
      return status;
  }
};

export const getDebtSourceLabel = (source: string): string => {
  if (source === "subscription") {
    return "اشتراك";
  }

  return "يدوي";
};

export const getDebtPaymentTypeLabel = (type: DebtPaymentType): string => {
  return type === "cash" ? "سداد نقدي" : "تسوية نظامية";
};
