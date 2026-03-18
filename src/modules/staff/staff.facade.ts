import { Op } from "sequelize";
import Staff from "./staff.model";

class StaffReadFacade {
  public async getStaffNamesByIds(
    centerId: number,
    staffIds: number[],
  ): Promise<Map<number, string>> {
    if (staffIds.length === 0) {
      return new Map<number, string>();
    }

    const uniqueIds = [...new Set(staffIds)].filter(
      (id) => Number.isInteger(id) && id > 0,
    );

    if (uniqueIds.length === 0) {
      return new Map<number, string>();
    }

    const staffRows = await Staff.findAll({
      where: {
        centerId,
        id: {
          [Op.in]: uniqueIds,
        },
      },
      attributes: ["id", "name"],
      raw: true,
    });

    const names = new Map<number, string>();
    for (const row of staffRows as Array<{ id: number; name: string }>) {
      names.set(Number(row.id), row.name);
    }

    return names;
  }
}

export const staffReadFacade = new StaffReadFacade();

