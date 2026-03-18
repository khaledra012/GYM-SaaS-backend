import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import { RateLimitMiddleware, globalErrorHandler, AppError } from "./shared";

// Module registrations
import { registerAuthModule } from "./modules/auth";
import { registerMemberModule } from "./modules/member";
import { registerPlanModule } from "./modules/plans";
import { registerSubscriptionModule } from "./modules/subscriptions";
import { registerCheckinModule } from "./modules/checkins";
import { registerAccountingModule } from "./modules/accounting";
import { registerDebtModule } from "./modules/debts";
import { registerStaffModule } from "./modules/staff";
import { registerPlatformAdminModule } from "./modules/platform-admin";
import { registerWhatsAppModule } from "./modules/whatsapp";

const app: Application = express();

// Security
app.use(helmet());

// Logging (development only)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Body parsing
app.use(express.json());

// Global rate limit
// app.use("/api", RateLimitMiddleware.globalLimiter);

// Register modules - each module self-registers its routes
registerAuthModule(app);
registerStaffModule(app);
registerMemberModule(app);
registerPlanModule(app);
registerSubscriptionModule(app);
registerCheckinModule(app);
registerAccountingModule(app);
registerDebtModule(app);
registerWhatsAppModule(app);
registerPlatformAdminModule(app);

// 404 catch-all
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`المسار ${req.originalUrl} غير موجود!`, 404));
});

// Global error handler - must be last
app.use(globalErrorHandler);

export default app;

