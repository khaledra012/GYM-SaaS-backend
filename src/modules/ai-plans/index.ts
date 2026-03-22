import { Application } from "express";
import aiPlanRoutes from "./ai-plan.routes";

export const registerAiPlanModule = (app: Application) => {
  app.use("/api/v1/ai-plans", aiPlanRoutes);
};

export { aiPlanService } from "./ai-plan.service";
