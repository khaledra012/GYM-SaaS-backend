import nodemailer from "nodemailer";

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
        this.from = `Gym System <${process.env.EMAIL_FROM}>`;
    }

    private newTransport() {
        return nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD,
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
        <h1 style="color: #2ecc71;">أهلاً بك في نظام إدارة الجيم!</h1>
        <p>عزيزي كابتن/ ${this.name}،</p>
        <p>سعداء جداً بانضمامك إلينا. الآن يمكنك البدء في إضافة المشتركين وإدارة اشتراكات جيمك بكل سهولة.</p>
        <p>إذا احتجت أي مساعدة، نحن هنا دائماً.</p>
      </div>
    `;
        await this.send("مرحباً بك في أسرة نظام إدارة الجيم 🚀", html);
    }

    async sendPasswordReset() {
        const html = `
      <div style="direction: rtl; font-family: sans-serif; border: 1px solid #ddd; padding: 20px;">
        <h2 style="color: #e74c3c;">طلب تغيير كلمة المرور</h2>
        <p>لقد تلقينا طلباً لتغيير كلمة المرور الخاصة بحسابك.</p>
        <p>يرجى الضغط على الزر أدناه لإتمام العملية (الرابط صالح لمدة 10 دقائق فقط):</p>
        <a href="${this.url}" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px;">تغيير كلمة المرور</a>
        <p>إذا لم تطلب هذا التغيير، يرجى تجاهل هذا الإيميل.</p>
      </div>
    `;
        await this.send("رابط استعادة كلمة المرور الخاص بك", html);
    }
}

export default Email;
