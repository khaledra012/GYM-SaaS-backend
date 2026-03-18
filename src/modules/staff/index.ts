import { Application } from "express";
import staffRoutes from "./staff.routes";

export const registerStaffModule = (app: Application) => {
  app.use("/api/v1/staff", staffRoutes);
};

export { staffReadFacade } from "./staff.facade";

