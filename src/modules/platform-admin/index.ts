import { Application } from "express";
import platformAdminRoutes from "./platform-admin.routes";

export const registerPlatformAdminModule = (app: Application) => {
  app.use("/api/v1/platform-admin", platformAdminRoutes);
};

