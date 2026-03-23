import fs from "fs/promises";
import os from "os";
import path from "path";
import { WhatsAppGateway } from "./whatsapp.gateway";

describe("WhatsAppGateway.sendDocument", () => {
  jest.setTimeout(15_000);

  const originalRandom = Math.random;
  let tempDirectory: string;

  beforeEach(async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wa-gateway-"));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    Math.random = originalRandom;

    if (tempDirectory) {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  });

  const createGateway = (socketOverrides?: Partial<Record<string, any>>) => {
    const socket = {
      user: { id: "201012345678:1@s.whatsapp.net" },
      sendPresenceUpdate: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn(),
      ...socketOverrides,
    };

    const gateway = new WhatsAppGateway(async () => undefined);
    (gateway as any).runtimes.set(1, {
      socket,
      reconnectHandle: null,
    });

    return { gateway, socket };
  };

  const createPdfFile = async () => {
    const filePath = path.join(tempDirectory, "plan.pdf");
    await fs.writeFile(filePath, Buffer.from("%PDF-1.4 test file"));
    return filePath;
  };

  it("sends the PDF as a document and delivers the caption as a follow-up text", async () => {
    const filePath = await createPdfFile();
    const { gateway, socket } = createGateway();

    socket.sendMessage
      .mockResolvedValueOnce({
        key: { id: "doc-msg-1" },
        message: { documentMessage: { mimetype: "application/pdf" } },
      })
      .mockResolvedValueOnce({
        key: { id: "text-msg-1" },
        message: { conversation: "Plan ready" },
      });

    const promise = gateway.sendDocument(1, "01012345678", {
      caption: "Plan ready",
      filePath,
      fileName: "خطة محمد.pdf",
      mimetype: "application/pdf",
    });

    const result = await promise;

    expect(result.messageId).toBe("doc-msg-1");
    expect(socket.sendMessage).toHaveBeenNthCalledWith(
      1,
      "201012345678@s.whatsapp.net",
      {
        document: { url: filePath },
        fileName: "attachment.pdf",
        mimetype: "application/pdf",
      },
    );
    expect(socket.sendMessage).toHaveBeenNthCalledWith(
      2,
      "201012345678@s.whatsapp.net",
      { text: "Plan ready" },
    );
  });

  it("does not fail the document delivery when the follow-up text cannot be sent", async () => {
    const filePath = await createPdfFile();
    const { gateway, socket } = createGateway();

    socket.sendMessage
      .mockResolvedValueOnce({
        key: { id: "doc-msg-2" },
        message: { documentMessage: { mimetype: "application/pdf" } },
      })
      .mockRejectedValueOnce(new Error("text send failed"));

    const promise = gateway.sendDocument(1, "01012345678", {
      caption: "Plan ready",
      filePath,
      fileName: "plan-final.pdf",
      mimetype: "application/pdf",
    });

    await expect(promise).resolves.toEqual({ messageId: "doc-msg-2" });
  });
});
