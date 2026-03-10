import { Application } from "express";
import checkinRoutes from "./checkin.routes";

export const registerCheckinModule = (app: Application) => {
  app.use("/api/v1/checkins", checkinRoutes);
};

export { checkinReadFacade } from "./checkin.facade";
