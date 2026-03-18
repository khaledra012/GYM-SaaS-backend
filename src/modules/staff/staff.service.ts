import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op, UniqueConstraintError } from "sequelize";
import { AppError, ActorRole, RequestActor } from "../../shared";
import { authReadFacade } from "../auth/auth.facade";
import Staff, { StaffRole, StaffStatus } from "./staff.model";
import {
  ICreateStaffDTO,
  IListStaffQuery,
  IStaffLoginDTO,
  IUpdateStaffDTO,
  IUpdateStaffStatusDTO,
} from "./staff.schema";
import {
  isAssignableStaffRole,
  normalizeOptionalPhone,
  normalizeStaffEmail,
} from "./staff.util";

interface IStaffListResult {
  data: ReturnType<StaffService["mapPublicStaff"]>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class StaffService {
  private mapPublicStaff(staff: Staff) {
    return {
      id: staff.id,
      centerId: staff.centerId,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
      status: staff.status,
      lastLoginAt: staff.lastLoginAt,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }

  private mapDuplicateError(error: unknown): never {
    if (error instanceof UniqueConstraintError) {
      const fieldName = error.errors[0]?.path ?? "";
      if (fieldName === "email") {
        throw new AppError("هذا البريد الإلكتروني مستخدم بالفعل", 409);
      }

      throw new AppError("هذه البيانات مستخدمة بالفعل", 409);
    }

    throw error;
  }

  private ensureRoleCanBeAssigned(role: StaffRole): void {
    if (!isAssignableStaffRole(role)) {
      throw new AppError("لا يمكن إنشاء موظف بدور مالك", 400);
    }
  }

  private async getStaffForCenterOrThrow(
    id: number,
    centerId: number,
  ): Promise<Staff> {
    const staff = await Staff.findOne({
      where: {
        id,
        centerId,
      },
    });

    if (!staff) {
      throw new AppError("الموظف غير موجود", 404);
    }

    return staff;
  }

  public async listStaff(
    centerId: number,
    query: IListStaffQuery,
  ): Promise<IStaffListResult> {
    const where: any = { centerId };

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const searchLike = `%${query.search}%`;
      where[Op.or] = [
        { name: { [Op.like]: searchLike } },
        { email: { [Op.like]: searchLike } },
        { phone: { [Op.like]: searchLike } },
      ];
    }

    const offset = (query.page - 1) * query.limit;

    const { rows, count } = await Staff.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      offset,
      limit: query.limit,
    });

    return {
      data: rows.map((item) => this.mapPublicStaff(item)),
      total: count,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(count / query.limit)),
    };
  }

  public async createStaff(centerId: number, data: ICreateStaffDTO) {
    this.ensureRoleCanBeAssigned(data.role);

    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const created = await Staff.create({
        centerId,
        name: data.name.trim(),
        email: normalizeStaffEmail(data.email),
        phone: normalizeOptionalPhone(data.phone),
        password: hashedPassword,
        role: data.role,
        status: "active",
      });

      return this.mapPublicStaff(created);
    } catch (error) {
      this.mapDuplicateError(error);
    }
  }

  public async updateStaff(centerId: number, id: number, data: IUpdateStaffDTO) {
    const staff = await this.getStaffForCenterOrThrow(id, centerId);

    if (data.role) {
      this.ensureRoleCanBeAssigned(data.role);
    }

    if (data.name !== undefined) {
      staff.name = data.name.trim();
    }

    if (data.email !== undefined) {
      staff.email = normalizeStaffEmail(data.email);
    }

    if (data.phone !== undefined) {
      staff.phone = normalizeOptionalPhone(data.phone);
    }

    if (data.role !== undefined) {
      staff.role = data.role;
    }

    try {
      await staff.save();
      return this.mapPublicStaff(staff);
    } catch (error) {
      this.mapDuplicateError(error);
    }
  }

  public async updateStaffStatus(
    centerId: number,
    id: number,
    data: IUpdateStaffStatusDTO,
  ) {
    const staff = await this.getStaffForCenterOrThrow(id, centerId);
    staff.status = data.status;
    await staff.save();
    return this.mapPublicStaff(staff);
  }

  public async resetStaffPassword(
    centerId: number,
    id: number,
    password: string,
  ): Promise<void> {
    const staff = await this.getStaffForCenterOrThrow(id, centerId);
    staff.password = await bcrypt.hash(password, 10);
    await staff.save();
  }

  public async login(input: IStaffLoginDTO) {
    const email = normalizeStaffEmail(input.email);

    const staff = await Staff.findOne({
      where: {
        email,
      },
    });

    if (!staff || !(await bcrypt.compare(input.password, staff.password))) {
      throw new AppError("بيانات الدخول غير صحيحة", 401);
    }

    if (staff.status !== "active") {
      throw new AppError("حساب الموظف غير مفعل", 403);
    }

    const center = await authReadFacade.getCenterForAccess(staff.centerId);
    if (!center) {
      throw new AppError("هذا الحساب لم يعد متاحًا", 401);
    }

    if (center.billingStatus === "unsubscribed") {
      throw new AppError(
        "الحساب غير مفعل حاليًا. يرجى سداد الاشتراك لإعادة التفعيل.",
        403,
      );
    }

    if (!process.env.JWT_SECRET) {
      throw new AppError("إعدادات الأمان غير مكتملة على الخادم", 500);
    }

    const token = jwt.sign(
      {
        type: "staff",
        staffId: staff.id,
        centerId: center.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    staff.lastLoginAt = new Date();
    await staff.save({ fields: ["lastLoginAt"] });

    return {
      token,
      actor: {
        id: staff.id,
        type: "staff",
        role: staff.role,
        centerId: center.id,
        name: staff.name,
        email: staff.email,
        staffId: staff.id,
      } as RequestActor,
      center: authReadFacade.mapCenterAuthSnapshot(center),
    };
  }

  public buildCurrentActor(center: any, actor: RequestActor) {
    if (actor.type === "center") {
      return {
        id: actor.id,
        name: center.name,
        email: center.email ?? null,
        phone: center.phone ?? null,
        role: "owner" as ActorRole,
        type: "center" as const,
        status: "active" as StaffStatus,
        centerId: center.id,
      };
    }

    return {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
      type: "staff" as const,
      status: "active" as StaffStatus,
      centerId: actor.centerId,
    };
  }
}

export const staffService = new StaffService();
