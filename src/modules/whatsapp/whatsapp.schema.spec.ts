import { WhatsAppValidation } from "./whatsapp.schema";

describe("WhatsAppValidation", () => {
  it("accepts a valid test message payload", () => {
    const parsed = WhatsAppValidation.sendTestMessage.parse({
      body: {
        phone: "01012345678",
        message: "رسالة اختبار",
      },
    });

    expect(parsed.body.phone).toBe("01012345678");
  });

  it("rejects an empty template body", () => {
    expect(() =>
      WhatsAppValidation.createTemplate.parse({
        body: {
          eventType: "member_welcome",
          name: "ترحيب",
          body: "",
        },
      }),
    ).toThrow();
  });

  it("accepts valid opt-in updates", () => {
    const parsed = WhatsAppValidation.updateMemberOptIn.parse({
      params: {
        memberId: 3,
      },
      body: {
        isOptedIn: true,
        source: "front_form",
      },
    });

    expect(parsed.body.isOptedIn).toBe(true);
    expect(parsed.params.memberId).toBe(3);
  });
});
