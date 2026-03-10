import { Op } from "sequelize";
import Checkin from "./checkin.model";
import { getCurrentDateOnlyInTimezone, normalizeTimezone } from "../../shared";

class CheckinReadFacade {
  public async countTodayApprovedUniqueMembers(
    centerId: number,
    centerTimezone?: string,
  ): Promise<number> {
    const timezone = normalizeTimezone(centerTimezone);
    const localDate = getCurrentDateOnlyInTimezone(timezone);

    return Checkin.count({
      where: {
        centerId,
        localDate,
        status: "approved",
        memberId: {
          [Op.not]: null,
        },
      },
      distinct: true,
      col: "memberId",
    });
  }
}

export const checkinReadFacade = new CheckinReadFacade();
