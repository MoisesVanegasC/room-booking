import type { Response, NextFunction } from "express";
import { createReservationService, checkInService, checkOutService, cancelReservationService } from "./service";
import { prisma } from "../../config/prisma";

export async function createReservation(req: any, res: Response, next: NextFunction) {
    try {
        const reservation = await createReservationService({
            userId: req.user.id,
            roomId: req.body.roomId,
            startAt: req.body.startAt,
            endAt: req.body.endAt,
        });

        return res.status(201).json(reservation);
    } catch (err) {
        next(err);
    }
}

export async function myReservations(req: any, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.reservation.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: "desc" },
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
    } catch (err) {
        next(err);
    }
}

export async function checkInReservation(req: any, res: Response, next: NextFunction) {
    try {
        const out = await checkInService({
            reservationId: req.params.id,
            actor: req.user, // { id, role }
        });
        res.status(200).json(out);
    } catch (e) {
        next(e);
    }
}

export async function checkOutReservation(req: any, res: Response, next: NextFunction) {
    try {
        const out = await checkOutService({
            reservationId: req.params.id,
            actor: req.user,
        });
        res.status(200).json(out);
    } catch (e) {
        next(e);
    }
}

export async function cancelReservation(req: any, res: Response, next: NextFunction) {
    try {
        const out = await cancelReservationService({
            reservationId: req.params.id,
            requester: req.user, // viene de requireAuth
        });
        res.status(200).json(out);
    } catch (e) {
        next(e);
    }
}