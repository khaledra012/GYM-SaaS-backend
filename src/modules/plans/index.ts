import { Application } from "express";
import planRoutes from "./plan.routes";

export const registerPlanModule = (app: Application) => {
  app.use("/api/v1/plans", planRoutes);
};

export { planReadFacade } from "./plan.facade";
