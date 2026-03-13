import { Response } from "express";
import { subscriptionService } from "./subscription.service";
import { catchAsync, AuthRequest } from "../../shared";
import {
  ICreateSubscriptionDTO,
  IListSubscriptionsQuery,
  IUpdateNotesDTO,
  IRenewTimeBasedDTO,
  IRenewSessionBasedDTO,
  IRenewExpiredDTO,
  IDeductSessionsDTO,
  IRefundSubscriptionDTO,
} from "./subscription.schema";

export const createSubscription = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as ICreateSubscriptionDTO;
    const subscription = await subscriptionService.createSubscription(
      data,
      req.center.id,
      req.center.timezone,
    );

    return res.status(201).json({
      status: "نجاح",
      data: subscription,
    });
  },
);

export const getSubscriptions = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const query = (req as any).validated.query as IListSubscriptionsQuery;
    const result = await subscriptionService.getSubscriptions(
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

export const getStats = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const stats = await subscriptionService.getStats(
      req.center.id,
      req.center.timezone,
    );
    return res.status(200).json({
      status: "نجاح",
      data: stats,
    });
  },
);

export const getSubscriptionById = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };
    const subscription = await subscriptionService.getSubscriptionById(
      id,
      req.center.id,
      req.center.timezone,
    );

    return res.status(200).json({
      status: "نجاح",
      data: subscription,
    });
  },
);

export const updateNotes = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as IUpdateNotesDTO;
    const { id } = (req as any).validated.params as { id: number };

    const subscription = await subscriptionService.updateNotes(
      id,
      req.center.id,
      data,
    );

    return res.status(200).json({
      status: "نجاح",
      data: subscription,
    });
  },
);

export const renewTimeBased = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as IRenewTimeBasedDTO;
    const { id } = (req as any).validated.params as { id: number };

    const subscription = await subscriptionService.renewTimeBased(
      id,
      req.center.id,
      data,
      req.center.timezone,
    );

    return res.status(200).json({
      status: "نجاح",
      data: subscription,
    });
  },
);

export const renewSessionBased = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as IRenewSessionBasedDTO;
    const { id } = (req as any).validated.params as { id: number };

    const subscription = await subscriptionService.renewSessionBased(
      id,
      req.center.id,
      data,
      req.center.timezone,
    );

    return res.status(200).json({
      status: "نجاح",
      data: subscription,
    });
  },
);

export const renewExpiredSubscription = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as IRenewExpiredDTO;
    const { id } = (req as any).validated.params as { id: number };

    const subscription = await subscriptionService.renewExpiredSubscription(
      id,
      req.center.id,
      data,
      req.center.timezone,
    );

    return res.status(200).json({
      status: "نجاح",
      message: "تم تجديد الاشتراك المنتهي بنجاح",
      data: subscription,
    });
  },
);

export const freezeSubscription = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };

    const subscription = await subscriptionService.freeze(id, req.center.id);

    return res.status(200).json({
      status: "نجاح",
      message: "تم تجميد الاشتراك بنجاح",
      data: subscription,
    });
  },
);

export const unfreezeSubscription = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };

    const subscription = await subscriptionService.unfreeze(id, req.center.id);

    return res.status(200).json({
      status: "نجاح",
      message: "تم فك تجميد الاشتراك بنجاح",
      data: subscription,
    });
  },
);

export const deductSessions = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as IDeductSessionsDTO;
    const { id } = (req as any).validated.params as { id: number };

    const subscription = await subscriptionService.deductSessions(
      id,
      req.center.id,
      data,
    );

    return res.status(200).json({
      status: "نجاح",
      data: subscription,
    });
  },
);

export const cancelSubscription = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };

    const subscription = await subscriptionService.cancelSubscription(
      id,
      req.center.id,
    );

    return res.status(200).json({
      status: "نجاح",
      message: "تم إلغاء الاشتراك بنجاح",
      data: subscription,
    });
  },
);

export const refundSubscription = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };
    const data = (req as any).validated.body as IRefundSubscriptionDTO;

    const subscription = await subscriptionService.refundSubscription(
      id,
      req.center.id,
      data,
      req.center.timezone,
    );

    return res.status(200).json({
      status: "نجاح",
      message: "تم تسجيل مرتجع الاشتراك بنجاح",
      data: subscription,
    });
  },
);

export const autoExpire = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const result = await subscriptionService.autoExpire(req.center.id);

    return res.status(200).json({
      status: "نجاح",
      ...result,
    });
  },
);

export const getTimeline = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };

    const events = await subscriptionService.getTimeline(id, req.center.id);

    return res.status(200).json({
      status: "نجاح",
      data: events,
    });
  },
);
