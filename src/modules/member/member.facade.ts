import { Transaction } from "sequelize";
import Member, { MemberAttributes } from "./member.model";

export interface IMemberLookup {
  id: number;
  status: MemberAttributes["status"];
}

export interface IMemberLookupByCode {
  id: number;
  code: string;
  name: string;
  phone: string;
  status: MemberAttributes["status"];
}

interface IMemberReadOptions {
  transaction?: Transaction;
  lock?: boolean;
}

class MemberReadFacade {
  private appendTransactionOptions(
    queryOptions: any,
    options: IMemberReadOptions,
  ) {
    if (options.transaction) {
      queryOptions.transaction = options.transaction;
      if (options.lock) {
        queryOptions.lock = true;
      }
    }
  }

  public async findByIdInCenter(
    memberId: number,
    centerId: number,
    options: IMemberReadOptions = {},
  ): Promise<IMemberLookup | null> {
    const queryOptions: any = {
      attributes: ["id", "status"],
      where: { id: memberId, centerId },
      raw: true,
    };

    this.appendTransactionOptions(queryOptions, options);

    const member = await Member.findOne(queryOptions);
    return (member as IMemberLookup | null) ?? null;
  }

  public async findByCodeInCenter(
    code: string,
    centerId: number,
    options: IMemberReadOptions = {},
  ): Promise<IMemberLookupByCode | null> {
    const queryOptions: any = {
      attributes: ["id", "code", "name", "phone", "status"],
      where: { code, centerId },
      raw: true,
    };

    this.appendTransactionOptions(queryOptions, options);

    const member = await Member.findOne(queryOptions);
    return (member as IMemberLookupByCode | null) ?? null;
  }

  public async activateIfInactiveInCenter(
    memberId: number,
    centerId: number,
    options: IMemberReadOptions = {},
  ): Promise<boolean> {
    const updateOptions: any = {
      where: {
        id: memberId,
        centerId,
        status: "inactive",
      },
    };

    this.appendTransactionOptions(updateOptions, options);

    const [affectedRows] = await Member.update(
      { status: "active" },
      updateOptions,
    );

    return affectedRows > 0;
  }
}

export const memberReadFacade = new MemberReadFacade();
