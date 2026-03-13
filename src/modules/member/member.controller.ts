import { Response } from "express";
import { catchAsync, AuthRequest } from "../../shared";
import { memberService } from "./member.service";
import {
  ICreateMemberDTO,
  IUpdateMemberDTO,
  IGetAllMembersQuery,
} from "./member.schema";

const withBarcodeFields = (member: any) => ({
  ...member,
  barcodeValue: member.code,
  barcodeSvgPath: `/api/v1/members/${member.id}/barcode.svg`,
});

export const createMember = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as ICreateMemberDTO;

    const member = await memberService.createMember(data, req.center.id);
    const memberData = member.toJSON();

    return res.status(201).json({
      status: "نجاح",
      message: "تم إضافة المشترك بنجاح",
      data: withBarcodeFields(memberData),
    });
  },
);

export const getAllMembers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const query = (req as any).validated.query as IGetAllMembersQuery;

    const result = await memberService.getAllMembers(req.center.id, query);

    return res.status(200).json({
      status: "نجاح",
      members: result.members,
      pagination: result.pagination,
    });
  },
);

export const getMemberById = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };

    const member = await memberService.getMemberDetailsById(id, req.center.id);

    return res.status(200).json({
      status: "نجاح",
      data: member,
    });
  },
);

export const getMemberBarcodeSvg = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };

    const barcodeSvg = await memberService.getMemberBarcodeSvg(id, req.center.id);

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).send(barcodeSvg);
  },
);

export const updateMember = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as IUpdateMemberDTO;
    const { id } = (req as any).validated.params as { id: number };

    const updatedMember = await memberService.updateMember(
      id,
      req.center.id,
      data,
    );

    const updatedMemberData = updatedMember.toJSON();

    return res.status(200).json({
      status: "نجاح",
      message: "تم التحديث بنجاح",
      data: withBarcodeFields(updatedMemberData),
    });
  },
);

export const deleteMember = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };

    await memberService.deleteMember(id, req.center.id);

    return res.status(204).send();
  },
);

export const getStats = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const stats = await memberService.getDashboardStats(
      req.center.id,
      req.center.timezone,
    );

    return res.status(200).json({
      status: "نجاح",
      stats,
    });
  },
);


