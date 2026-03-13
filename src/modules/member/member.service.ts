import { Op } from "sequelize";
import { AppError } from "../../shared";
import bwipjs from "bwip-js";
import Member, { MemberCreationAttributes } from "./member.model";
import {
  ICreateMemberDTO,
  IUpdateMemberDTO,
  IGetAllMembersQuery,
} from "./member.schema";
import {
  IMemberSubscriptionSnapshot,
  subscriptionReadFacade,
} from "../subscriptions/subscription.facade";
import { checkinReadFacade } from "../checkins/checkin.facade";
import { debtReadFacade } from "../debts/debt.facade";

type MemberStatusFilter = "active" | "inactive" | "rejected";
type SubscriptionStatusFilter =
  | "active"
  | "frozen"
  | "expired"
  | "cancelled"
  | "none";

type SubscriptionTypeFilter = "time_based" | "session_based";

interface IResolvedMemberFilters {
  memberStatus?: MemberStatusFilter;
  subscriptionStatus?: SubscriptionStatusFilter;
  subscriptionType?: SubscriptionTypeFilter;
}

class MemberService {
  private async generateUniqueCode(centerId: number): Promise<string> {
    let isUnique = false;
    let code = "";

    while (!isUnique) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      const existingCode = await Member.findOne({ where: { code, centerId } });
      if (!existingCode) {
        isUnique = true;
      }
    }

    return code;
  }

  private mapMemberWithSubscription(
    member: Member,
    snapshot?: IMemberSubscriptionSnapshot,
    debtSummary?: {
      totalDebtAmountCents: number;
      totalDebtAmount: string;
      outstandingDebtAmountCents: number;
      outstandingDebtAmount: string;
      outstandingDebtCount: number;
    },
  ) {
    const memberData = member.toJSON();

    return {
      ...memberData,
      subscriptionId: snapshot?.id ?? null,
      subscriptionType: snapshot?.type ?? null,
      subscriptionStatus: snapshot?.effectiveStatus ?? null,
      subscriptionEndDate: snapshot?.endDate ?? null,
      totalDebtAmountCents: debtSummary?.totalDebtAmountCents ?? 0,
      totalDebtAmount: debtSummary?.totalDebtAmount ?? "0.00",
      outstandingDebtAmountCents: debtSummary?.outstandingDebtAmountCents ?? 0,
      outstandingDebtAmount: debtSummary?.outstandingDebtAmount ?? "0.00",
      outstandingDebtCount: debtSummary?.outstandingDebtCount ?? 0,
      barcodeValue: memberData.code,
      barcodeSvgPath: `/api/v1/members/${memberData.id}/barcode.svg`,
    };
  }

  public async getMemberBarcodeSvg(id: number, centerId: number): Promise<string> {
    const member = await this.getMemberById(id, centerId);

    try {
      return bwipjs.toSVG({
        bcid: "code128",
        text: member.code,
        scale: 3,
        height: 12,
        includetext: false,
      });
    } catch {
      throw new AppError("\u062a\u0639\u0630\u0631 \u062a\u0648\u0644\u064a\u062f \u0628\u0627\u0631\u0643\u0648\u062f \u0627\u0644\u0639\u0636\u0648", 500);
    }
  }

  private resolveFilters(queryParams: IGetAllMembersQuery): IResolvedMemberFilters {
    const statusFromLegacy = queryParams.status;

    const memberStatusFromLegacy =
      statusFromLegacy === "active" ||
      statusFromLegacy === "inactive" ||
      statusFromLegacy === "rejected"
        ? statusFromLegacy
        : undefined;

    const subscriptionStatusFromLegacy =
      statusFromLegacy === "frozen" ||
      statusFromLegacy === "expired" ||
      statusFromLegacy === "cancelled" ||
      statusFromLegacy === "none"
        ? statusFromLegacy
        : undefined;

    const memberStatus =
      queryParams.memberStatus && queryParams.memberStatus !== "all"
        ? queryParams.memberStatus
        : memberStatusFromLegacy;

    return {
      memberStatus,
      subscriptionStatus:
        queryParams.subscriptionStatus ?? subscriptionStatusFromLegacy,
      subscriptionType: queryParams.subscriptionType,
    };
  }

  private matchesSubscriptionFilters(
    snapshot: IMemberSubscriptionSnapshot | undefined,
    subscriptionStatus?: SubscriptionStatusFilter,
    subscriptionType?: SubscriptionTypeFilter,
  ): boolean {
    if (subscriptionStatus === "none" && snapshot) {
      return false;
    }

    if (
      subscriptionStatus &&
      subscriptionStatus !== "none" &&
      (!snapshot || snapshot.effectiveStatus !== subscriptionStatus)
    ) {
      return false;
    }

    if (subscriptionType && (!snapshot || snapshot.type !== subscriptionType)) {
      return false;
    }

    return true;
  }

  public async createMember(
    data: ICreateMemberDTO,
    centerId: number,
  ): Promise<Member> {
    const existingMember = await Member.findOne({
      where: { phone: data.phone, centerId },
    });
    if (existingMember) {
      throw new AppError("\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641 \u0645\u0633\u062c\u0644 \u0644\u0645\u0634\u062a\u0631\u0643 \u0622\u062e\u0631 \u0641\u064a \u0627\u0644\u0645\u0631\u0643\u0632", 400);
    }

    const code = await this.generateUniqueCode(centerId);

    const safeData: MemberCreationAttributes = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      gender: data.gender,
      status: data.status || "inactive",
      membershipStart: data.membershipStart,
      centerId,
      code,
    };

    return await Member.create(safeData);
  }

  public async getAllMembers(
    centerId: number,
    queryParams: IGetAllMembersQuery,
  ) {
    const { search, page = 1, limit = 50 } = queryParams;
    const { memberStatus, subscriptionStatus, subscriptionType } =
      this.resolveFilters(queryParams);

    const whereCondition: any = { centerId };

    if (memberStatus) {
      whereCondition.status = memberStatus;
    }

    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    if (!subscriptionStatus && !subscriptionType) {
      const { rows: members, count: total } = await Member.findAndCountAll({
        where: whereCondition,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      const memberIds = members.map((member) => member.id);
      const subscriptionsByMember =
        await subscriptionReadFacade.getLatestByMemberIds(centerId, memberIds);

      const membersWithSubscription = members.map((member) =>
        this.mapMemberWithSubscription(member, subscriptionsByMember.get(member.id)),
      );

      return {
        members: membersWithSubscription,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const allMembers = await Member.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
    });

    const memberIds = allMembers.map((member) => member.id);
    const subscriptionsByMember = await subscriptionReadFacade.getLatestByMemberIds(
      centerId,
      memberIds,
    );

    const filteredMembers = allMembers.filter((member) =>
      this.matchesSubscriptionFilters(
        subscriptionsByMember.get(member.id),
        subscriptionStatus,
        subscriptionType,
      ),
    );

    const total = filteredMembers.length;
    const paginatedMembers = filteredMembers.slice(offset, offset + limit);

    const membersWithSubscription = paginatedMembers.map((member) =>
      this.mapMemberWithSubscription(member, subscriptionsByMember.get(member.id)),
    );

    return {
      members: membersWithSubscription,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async getMemberById(id: number, centerId: number): Promise<Member> {
    const member = await Member.findOne({ where: { id, centerId } });
    if (!member) {
      throw new AppError("\u0627\u0644\u0645\u0634\u062a\u0631\u0643 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f", 404);
    }

    return member;
  }

  public async getMemberDetailsById(id: number, centerId: number) {
    const member = await this.getMemberById(id, centerId);
    const subscriptionsByMember =
      await subscriptionReadFacade.getLatestByMemberIds(centerId, [id]);
    const debtSummary = await debtReadFacade.getMemberDebtSummary(id, centerId);

    return this.mapMemberWithSubscription(
      member,
      subscriptionsByMember.get(id),
      debtSummary,
    );
  }

  public async updateMember(
    id: number,
    centerId: number,
    data: IUpdateMemberDTO,
  ): Promise<Member> {
    const member = await this.getMemberById(id, centerId);

    if (data.phone && data.phone !== member.phone) {
      const existing = await Member.findOne({
        where: { phone: data.phone, centerId },
      });
      if (existing) throw new AppError("\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641 \u0645\u0633\u062a\u062e\u062f\u0645 \u0628\u0627\u0644\u0641\u0639\u0644", 400);
    }

    const safeUpdateData: Partial<MemberCreationAttributes> = {};

    if (data.name !== undefined) safeUpdateData.name = data.name;
    if (data.phone !== undefined) safeUpdateData.phone = data.phone;
    if (data.email !== undefined) safeUpdateData.email = data.email;
    if (data.gender !== undefined) safeUpdateData.gender = data.gender;
    if (data.status !== undefined) safeUpdateData.status = data.status;
    if (data.membershipStart !== undefined) {
      safeUpdateData.membershipStart = data.membershipStart;
    }

    await member.update(safeUpdateData);
    return member;
  }

  public async deleteMember(id: number, centerId: number): Promise<void> {
    const member = await this.getMemberById(id, centerId);
    await member.destroy();
  }

  public async getDashboardStats(centerId: number, centerTimezone?: string) {

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalMembers = await Member.count({ where: { centerId } });
    const activeMembers = await Member.count({
      where: { centerId, status: "active" },
    });

    const expiringSoonSummary = await subscriptionReadFacade.getExpiringSoonSummary(
      centerId,
      centerTimezone,
    );

    const newMembers = await Member.count({
      where: { centerId, createdAt: { [Op.gte]: thirtyDaysAgo } },
    });

    const todayCheckedInMembers =
      await checkinReadFacade.countTodayApprovedUniqueMembers(
        centerId,
        centerTimezone,
      );

    return {
      totalMembers,
      activeMembers,
      expiringSoon: expiringSoonSummary.expiringSoon,
      expiringSoonBreakdown: expiringSoonSummary.expiringSoonBreakdown,
      expiringSoonItems: expiringSoonSummary.expiringSoonItems,
      newMembers,
      todayCheckedInMembers,
    };
  }
}

export const memberService = new MemberService();




