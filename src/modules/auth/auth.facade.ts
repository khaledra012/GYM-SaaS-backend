import Center from "./auth.model";

interface ICenterLookup {
  id: number;
}

class AuthReadFacade {
  public async getAllCenterIds(): Promise<number[]> {
    const centers = await Center.findAll({
      attributes: ["id"],
      raw: true,
    });

    return (centers as ICenterLookup[])
      .map((center) => Number(center.id))
      .filter((centerId) => Number.isInteger(centerId) && centerId > 0);
  }
}

export const authReadFacade = new AuthReadFacade();
