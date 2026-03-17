import { Request } from "express";

export type ActorType = "center" | "staff";

export type ActorRole = "owner" | "manager" | "receptionist";

export interface RequestActor {
  id: number;
  type: ActorType;
  role: ActorRole;
  centerId: number;
  name: string;
  email: string | null;
  staffId: number | null;
}

export interface JwtPayload {
  id?: number;
  type?: ActorType;
  staffId?: number;
  centerId?: number;
  iat: number;
  exp: number;
}

export interface AuthRequest extends Request {
  center: any;
  actor: RequestActor;
  validated: {
    body: any;
    params: any;
    query: any;
  };
}
