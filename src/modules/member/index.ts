import { Application } from "express";
import memberRoutes from "./member.routes";

export const registerMemberModule = (app: Application) => {
  app.use("/api/v1/members", memberRoutes);
};

export { memberReadFacade } from "./member.facade";
