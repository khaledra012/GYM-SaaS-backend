import { Response } from "express";
import { AuthRequest, catchAsync } from "../../shared";
import { checkinService } from "./checkin.service";
import { ICreateCheckinDTO, IListTodayCheckinsQuery } from "./checkin.schema";

export const createCheckin = catchAsync(async (req: AuthRequest, res: Response) => {
  const data = (req as any).validated.body as ICreateCheckinDTO;

  const result = await checkinService.createCheckin(
    data,
    req.center.id,
    req.center.timezone,
  );

  return res.status(200).json({
    status: "نجاح",
    data: result,
  });
});

export const getTodayCheckins = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const query = (req as any).validated.query as IListTodayCheckinsQuery;

    const result = await checkinService.getTodayCheckins(
      req.center.id,
      query,
      req.center.timezone,
    );

    return res.status(200).json({
      status: "نجاح",
      ...result,
    });
  },
);


