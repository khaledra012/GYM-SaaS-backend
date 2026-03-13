/**
 * Structured Logger utility
 * يستخدم بدل console.log / console.error في كل المشروع
 */

type LogLevel = "info" | "warn" | "error" | "debug";

class Logger {
    private formatMessage(level: LogLevel, message: string, meta?: object): string {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    }

    public info(message: string, meta?: object): void {
        console.log(this.formatMessage("info", message, meta));
    }

    public warn(message: string, meta?: object): void {
        console.warn(this.formatMessage("warn", message, meta));
    }

    public error(message: string, meta?: object): void {
        console.error(this.formatMessage("error", message, meta));
    }

    public debug(message: string, meta?: object): void {
        if (process.env.NODE_ENV === "development") {
            console.debug(this.formatMessage("debug", message, meta));
        }
    }
}

export const logger = new Logger();
