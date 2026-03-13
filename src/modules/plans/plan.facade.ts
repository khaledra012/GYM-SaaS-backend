import { Transaction } from "sequelize";
import Plan from "./plan.model";

export interface IPlanForSubscription {
  id: number;
  price: string;
  type: "time_based" | "session_based";
  durationInDays: number | null;
  sessionCount: number | null;
}

interface IPlanReadOptions {
  transaction?: Transaction;
  lock?: boolean;
}

class PlanReadFacade {
  public async findByIdForSubscription(
    planId: number,
    centerId: number,
    options: IPlanReadOptions = {},
  ): Promise<IPlanForSubscription | null> {
    const queryOptions: any = {
      attributes: ["id", "price", "type", "durationInDays", "sessionCount"],
      where: { id: planId, centerId },
      raw: true,
    };

    if (options.transaction) {
      queryOptions.transaction = options.transaction;
      if (options.lock) {
        queryOptions.lock = true;
      }
    }

    const plan = await Plan.findOne(queryOptions);
    return (plan as IPlanForSubscription | null) ?? null;
  }
}

export const planReadFacade = new PlanReadFacade();
