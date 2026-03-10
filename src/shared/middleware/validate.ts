import { Request, Response, NextFunction } from "express";
import { ZodTypeAny, ZodError } from "zod";
import AppError from "../utils/AppError";

/**
 * Zod validation middleware
 * بيحقق الـ body, query, params ويحط النتيجة في req.validated
 */
export const validate = (schema: ZodTypeAny) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const validData = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });

            (req as any).validated = validData;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errorMessage = error.issues.map((err) => err.message).join(" , ");
                return next(new AppError(errorMessage, 400));
            }

            next(error);
        }
    };
};
