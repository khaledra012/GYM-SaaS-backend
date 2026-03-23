jest.mock("../auth", () => ({
  authReadFacade: {
    getCenterForAccess: jest.fn(),
    getAllCenterIds: jest.fn(),
  },
}));

jest.mock("../member", () => ({
  memberReadFacade: {
    findContactByIdInCenter: jest.fn(),
  },
}));

jest.mock("../subscriptions", () => ({
  subscriptionReadFacade: {
    getExpiringSoonSummary: jest.fn(),
  },
}));

jest.mock("./whatsapp.service", () => ({
  whatsAppService: {
    queueTemplateMessage: jest.fn(),
    queueDocumentMessage: jest.fn(),
  },
}));

import { authReadFacade } from "../auth";
import { memberReadFacade } from "../member";
import { whatsAppCommandFacade } from "./whatsapp.facade";
import { whatsAppService } from "./whatsapp.service";

describe("WhatsAppCommandFacade.queueAiPlanPdfMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queues a text message then queues the PDF document as a separate message", async () => {
    (authReadFacade.getCenterForAccess as jest.Mock).mockResolvedValue({
      id: 9,
      name: "Khaled Ramadan",
    });
    (memberReadFacade.findContactByIdInCenter as jest.Mock).mockResolvedValue({
      id: 15,
      name: "Khaled Ramadan",
      phone: "01060508475",
    });
    (whatsAppService.queueTemplateMessage as jest.Mock).mockResolvedValue({
      queued: true,
      message: { id: 101 },
    });
    (whatsAppService.queueDocumentMessage as jest.Mock).mockResolvedValue({
      queued: true,
      message: { id: 102 },
    });

    const result = await whatsAppCommandFacade.queueAiPlanPdfMessage({
      centerId: 9,
      memberId: 15,
      filePath: "/app/storage/ai-plans/9/plan.pdf",
      fileName: "plan.pdf",
      dedupeKey: "ai-plan-pdf:2:123456",
    });

    expect(whatsAppService.queueTemplateMessage).toHaveBeenCalledTimes(1);
    expect(whatsAppService.queueDocumentMessage).toHaveBeenCalledTimes(1);
    expect(whatsAppService.queueTemplateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        centerId: 9,
        eventType: "ai_plan_pdf",
        memberId: 15,
        phone: "01060508475",
        dedupeKey: "ai-plan-pdf:2:123456:text",
      }),
    );
    expect(whatsAppService.queueDocumentMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        centerId: 9,
        eventType: "ai_plan_pdf",
        memberId: 15,
        phone: "01060508475",
        filePath: "/app/storage/ai-plans/9/plan.pdf",
        fileName: "plan.pdf",
        dedupeKey: "ai-plan-pdf:2:123456:document",
      }),
    );
    expect(result).toEqual({
      queued: true,
      message: { id: 102 },
    });
  });

  it("stops and returns failure when text queueing fails", async () => {
    (authReadFacade.getCenterForAccess as jest.Mock).mockResolvedValue({
      id: 9,
      name: "Khaled Ramadan",
    });
    (memberReadFacade.findContactByIdInCenter as jest.Mock).mockResolvedValue({
      id: 15,
      name: "Khaled Ramadan",
      phone: "01060508475",
    });
    (whatsAppService.queueTemplateMessage as jest.Mock).mockResolvedValue({
      queued: false,
      reason: "text_failed",
      message: null,
    });

    const result = await whatsAppCommandFacade.queueAiPlanPdfMessage({
      centerId: 9,
      memberId: 15,
      filePath: "/app/storage/ai-plans/9/plan.pdf",
      fileName: "plan.pdf",
      dedupeKey: "ai-plan-pdf:2:123456",
    });

    expect(whatsAppService.queueTemplateMessage).toHaveBeenCalledTimes(1);
    expect(whatsAppService.queueDocumentMessage).not.toHaveBeenCalled();
    expect(result).toEqual({
      queued: false,
      reason: "text_failed",
      message: null,
    });
  });
});
