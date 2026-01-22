import type { Response, NextFunction } from "express";

export function requireAdmin(req: any, _res: Response, next: NextFunction) {
    // Asumimos que requireAuth ya puso req.user
    if (req.user?.role !== "ADMIN") {
        return next(
            Object.assign(new Error("No autorizado"), {
                statusCode: 403,
                code: "FORBIDDEN",
            })
        );
    }
    next();
}
