import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma";

export async function listRooms(_req: Request, res: Response, next: NextFunction) {
    try {
        const rooms = await prisma.room.findMany({
            select: { id: true, name: true, capacity: true, isActive: true, slotMinutes: true },
            orderBy: { createdAt: "asc" },
        });
        res.json(rooms);
    } catch (e) {
        next(e);
    }
}

export async function createRoom(req: Request, res: Response, next: NextFunction) {
    try {
        const name = String(req.body?.name ?? "").trim();
        const capacity = Number(req.body?.capacity);
        const slotMinutes = req.body?.slotMinutes != null ? Number(req.body.slotMinutes) : 60;

        if (!name) throw Object.assign(new Error("name requerido"), { statusCode: 400 });
        if (!Number.isInteger(capacity) || capacity <= 0) {
            throw Object.assign(new Error("capacity inválido"), { statusCode: 400 });
        }
        if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
            throw Object.assign(new Error("slotMinutes inválido"), { statusCode: 400 });
        }

        const room = await prisma.room.create({
            data: { name, capacity, slotMinutes },
            select: { id: true, name: true, capacity: true, slotMinutes: true, isActive: true },
        });

        res.status(201).json(room);
    } catch (e) {
        next(e);
    }
}
