import {
  applySpintax,
  buildSequentialDispatchTimes,
  classifyWhatsAppFailure,
  getRandomizedDispatchGapMs,
  getRetryDelayMinutes,
  normalizeWhatsAppPhone,
  renderAndSpinWhatsAppTemplate,
  shouldMarkSessionDegraded,
  shouldPauseGlobalModule,
} from "./whatsapp.util";

describe("whatsapp.util", () => {
  it("renders placeholders and spintax in one pass", () => {
    const result = renderAndSpinWhatsAppTemplate(
      "{أهلاً|مرحبًا} {{name}}",
      { name: "خالد" },
      () => 0,
    );

    expect(result).toBe("أهلاً خالد");
  });

  it("normalizes local egyptian phone numbers", () => {
    expect(normalizeWhatsAppPhone("01012345678")).toBe("201012345678");
    expect(normalizeWhatsAppPhone("+201012345678")).toBe("201012345678");
  });

  it("returns null for invalid phone numbers", () => {
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });

  it("uses exponential backoff minutes", () => {
    expect(getRetryDelayMinutes(1)).toBe(1);
    expect(getRetryDelayMinutes(2)).toBe(5);
    expect(getRetryDelayMinutes(3)).toBe(15);
    expect(getRetryDelayMinutes(4)).toBe(15);
  });

  it("pauses the global module only when failure rate exceeds 50%", () => {
    expect(
      shouldPauseGlobalModule({
        totalAttempts: 10,
        failedAttempts: 5,
      }),
    ).toBe(false);

    expect(
      shouldPauseGlobalModule({
        totalAttempts: 10,
        failedAttempts: 6,
      }),
    ).toBe(true);
  });

  it("marks a session degraded when its failure rate is high enough", () => {
    expect(
      shouldMarkSessionDegraded({
        totalAttempts: 5,
        failedAttempts: 3,
      }),
    ).toBe(true);
  });

  it("classifies invalid recipient failures as fatal", () => {
    const failure = classifyWhatsAppFailure(
      Object.assign(new Error("recipient does not have whatsapp"), {
        code: "recipient_not_registered",
      }),
    );

    expect(failure.failureType).toBe("fatal");
    expect(failure.failureCode).toBe("recipient_not_registered");
  });

  it("classifies session outages as retryable", () => {
    const failure = classifyWhatsAppFailure(
      Object.assign(new Error("session unavailable"), {
        code: "session_unavailable",
      }),
    );

    expect(failure.failureType).toBe("retryable");
    expect(failure.failureCode).toBe("session_unavailable");
  });

  it("keeps spintax deterministic with injected random", () => {
    expect(applySpintax("{أهلاً|مرحبًا|يا بطل}", () => 0.99)).toBe("يا بطل");
  });

  it("builds randomized dispatch gaps within the expected window", () => {
    const gap = getRandomizedDispatchGapMs(() => 0, 20, 60);
    expect(gap).toBe(20000);
  });

  it("builds sequential dispatch times cumulatively", () => {
    const baseDate = new Date("2026-03-19T10:00:00.000Z");
    const result = buildSequentialDispatchTimes(3, baseDate, () => 0);

    expect(result[0].toISOString()).toBe("2026-03-19T10:00:20.000Z");
    expect(result[1].toISOString()).toBe("2026-03-19T10:00:40.000Z");
    expect(result[2].toISOString()).toBe("2026-03-19T10:01:00.000Z");
  });
});
