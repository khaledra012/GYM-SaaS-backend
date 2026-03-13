import { Request } from "express";

export interface JwtPayload {
    id: number;
    iat: number;
    exp: number;
}

export interface AuthRequest extends Request {
    center: any;
    validated: {
        body: any;
        params: any;
        query: any;
    };
}
