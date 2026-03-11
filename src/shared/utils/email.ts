import nodemailer, { Transporter } from "nodemailer";

export interface EmailRecipient {
  email: string;
  name: string;
}

class Email {
  private to: string;
  private name: string;
  private url: string;
  private from: string;

  constructor(recipient: EmailRecipient, url: string = "") {
    this.to = recipient.email;
    this.name = recipient.name;
    this.url = url;
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USERNAME || "no-reply@gym-system.local";
    this.from = `Gym System <${from}>`;
  }

  private toBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) {
      return fallback;
    }

    return value === "true" || value === "1";
  }

  private newTransport(): Transporter {
    const host = process.env.EMAIL_HOST;
    const portRaw = process.env.EMAIL_PORT;
    const port = portRaw ? Number(portRaw) : 587;
    const secure = this.toBoolean(process.env.EMAIL_SECURE, port === 465);
    const rejectUnauthorized = this.toBoolean(
      process.env.EMAIL_TLS_REJECT_UNAUTHORIZED,
      true,
    );

    const user = process.env.EMAIL_USERNAME;
    const pass = process.env.EMAIL_PASSWORD;

    if (!user || !pass) {
      throw new Error("بيانات اعتماد الإيميل غير مكتملة: EMAIL_USERNAME / EMAIL_PASSWORD");
    }

    // Prefer explicit SMTP settings from env for deployment compatibility.
    if (host) {
      return nodemailer.createTransport({
        host,
        port: Number.isFinite(port) ? port : 587,
        secure,
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized,
        },
      });
    }

    // Backward-compatible fallback.
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
    });
  }

  async send(subject: string, html: string) {
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
    };

    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    const html = `
      <div style="direction: rtl; font-family: sans-serif; border: 1px solid #ddd; padding: 20px;">
        <h1 style="color: #2ecc71;">\u0623\u0647\u0644\u0627\u064b \u0628\u0643 \u0641\u064a \u0646\u0638\u0627\u0645 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062c\u064a\u0645!</h1>
        <p>\u0639\u0632\u064a\u0632\u064a \u0643\u0627\u0628\u062a\u0646/ ${this.name}\u060c</p>
        <p>\u0633\u0639\u062f\u0627\u0621 \u062c\u062f\u0627\u064b \u0628\u0627\u0646\u0636\u0645\u0627\u0645\u0643 \u0625\u0644\u064a\u0646\u0627. \u0627\u0644\u0622\u0646 \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0628\u062f\u0621 \u0641\u064a \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0634\u062a\u0631\u0643\u064a\u0646 \u0648\u0625\u062f\u0627\u0631\u0629 \u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a \u062c\u064a\u0645\u0643 \u0628\u0643\u0644 \u0633\u0647\u0648\u0644\u0629.</p>
        <p>\u0625\u0630\u0627 \u0627\u062d\u062a\u062c\u062a \u0623\u064a \u0645\u0633\u0627\u0639\u062f\u0629\u060c \u0646\u062d\u0646 \u0647\u0646\u0627 \u062f\u0627\u0626\u0645\u0627\u064b.</p>
      </div>
    `;

    await this.send(
      "\u0645\u0631\u062d\u0628\u0627\u064b \u0628\u0643 \u0641\u064a \u0623\u0633\u0631\u0629 \u0646\u0638\u0627\u0645 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062c\u064a\u0645 \ud83d\ude80",
      html,
    );
  }

  async sendPasswordReset() {
    const html = `
      <div style="direction: rtl; font-family: sans-serif; border: 1px solid #ddd; padding: 20px;">
        <h2 style="color: #e74c3c;">\u0637\u0644\u0628 \u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</h2>
        <p>\u0644\u0642\u062f \u062a\u0644\u0642\u064a\u0646\u0627 \u0637\u0644\u0628\u0627\u064b \u0644\u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u062d\u0633\u0627\u0628\u0643.</p>
        <p>\u064a\u0631\u062c\u0649 \u0627\u0644\u0636\u063a\u0637 \u0639\u0644\u0649 \u0627\u0644\u0632\u0631 \u0623\u062f\u0646\u0627\u0647 \u0644\u0625\u062a\u0645\u0627\u0645 \u0627\u0644\u0639\u0645\u0644\u064a\u0629 (\u0627\u0644\u0631\u0627\u0628\u0637 \u0635\u0627\u0644\u062d \u0644\u0645\u062f\u0629 10 \u062f\u0642\u0627\u0626\u0642 \u0641\u0642\u0637):</p>
        <a href="${this.url}" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px;">\u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</a>
        <p>\u0625\u0630\u0627 \u0644\u0645 \u062a\u0637\u0644\u0628 \u0647\u0630\u0627 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u060c \u064a\u0631\u062c\u0649 \u062a\u062c\u0627\u0647\u0644 \u0647\u0630\u0627 \u0627\u0644\u0625\u064a\u0645\u064a\u0644.</p>
      </div>
    `;

    await this.send(
      "\u0631\u0627\u0628\u0637 \u0627\u0633\u062a\u0639\u0627\u062f\u0629 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062e\u0627\u0635 \u0628\u0643",
      html,
    );
  }
}

export default Email;
