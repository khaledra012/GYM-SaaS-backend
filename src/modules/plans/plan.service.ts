import Plan, { PlanCreationAttributes } from "./plan.model";
import { AppError } from "../../shared";
import { ICreatePlanDTO, IUpdatePlanDTO } from "./plan.schema";

class PlanService {
  public async createPlan(
    data: ICreatePlanDTO,
    centerId: number,
  ): Promise<Plan> {
    const safeData: PlanCreationAttributes = {
      name: data.name,
      description: data.description ?? null,
      price: String(data.price),
      type: data.type,
      durationInDays:
        data.type === "time_based" ? (data.durationInDays ?? null) : null,
      sessionCount:
        data.type === "session_based" ? (data.sessionCount ?? null) : null,
      centerId,
    };

    return await Plan.create(safeData);
  }

  public async getAllPlans(centerId: number): Promise<Plan[]> {
    return await Plan.findAll({
      where: { centerId },
      order: [["createdAt", "DESC"]],
    });
  }

  public async getPlanById(id: number, centerId: number): Promise<Plan> {
    // paranoid: true يستثني الخطط المحذوفة soft-delete تلقائيًا
    const plan = await Plan.findOne({
      where: { id, centerId },
    });
    if (!plan) throw new AppError("الباقة غير موجودة أو تم حذفها", 404);
    return plan;
  }

  public async updatePlan(
    id: number,
    centerId: number,
    data: IUpdatePlanDTO,
  ): Promise<Plan> {
    const plan = await this.getPlanById(id, centerId);

    if (data.type && data.type !== plan.type) {
      throw new AppError(
        "لا يمكن تغيير نوع الباقة بعد إنشائها. أنشئ باقة جديدة.",
        400,
      );
    }

    const safeUpdateData: Partial<PlanCreationAttributes> = {};

    if (data.name !== undefined) safeUpdateData.name = data.name;
    if (data.description !== undefined)
      safeUpdateData.description = data.description ?? null;
    if (data.price !== undefined) safeUpdateData.price = String(data.price);

    // تحديث الحقل المناسب حسب نوع الباقة الحالي
    if (plan.type === "time_based" && data.durationInDays !== undefined) {
      safeUpdateData.durationInDays = data.durationInDays;
    }
    if (plan.type === "session_based" && data.sessionCount !== undefined) {
      safeUpdateData.sessionCount = data.sessionCount;
    }

    await plan.update(safeUpdateData);
    return plan;
  }

  public async deletePlan(id: number, centerId: number): Promise<void> {
    const plan = await this.getPlanById(id, centerId);
    // paranoid: true يجعل الحذف soft-delete عبر تعبئة deletedAt
    await plan.destroy();
  }
}

export const planService = new PlanService();
