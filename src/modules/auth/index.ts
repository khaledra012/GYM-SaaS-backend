import { Application } from "express";
import authRoutes from "./auth.routes";

export const registerAuthModule = (app: Application) => {
  app.use("/api/v1/auth", authRoutes);
};

export { authReadFacade } from "./auth.facade";
