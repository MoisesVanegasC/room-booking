import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma";

export async function listReservations(_req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.reservation.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
                id: true,
                roomId: true,
                startAt: true,
                endAt: true,
                status: true,
                createdAt: true,
            },
        });

        res.json({ reservations: rows });
    } catch (e) {
        next(e);
    }
}
