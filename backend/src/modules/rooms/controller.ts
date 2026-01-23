import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma";
import { getAvailabilityService } from "./service";
import { getRoomRulesService, upsertRoomRuleService, createDefaultRoomRulesService } from "./rules.service";


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

export async function getRoomAvailability(req: any, res: Response, next: NextFunction) {
    try {
        const out = await getAvailabilityService({
            roomId: req.params.id,
            date: req.query.date,
        });
        res.json(out);
    } catch (e) {
        next(e);
    }
}

export async function getRoomRules(req: Request, res: Response, next: NextFunction) {
    try {
        const out = await getRoomRulesService({ roomId: req.params.id });
        res.json(out);
    } catch (e) {
        next(e);
    }
}

export async function putRoomRule(req: Request, res: Response, next: NextFunction) {
    try {
        const out = await upsertRoomRuleService({
            roomId: req.params.id,
            dayOfWeek: req.params.dayOfWeek,
            openAt: req.body?.openAt,
            closeAt: req.body?.closeAt,
            isClosed: req.body?.isClosed,
        });
        res.json(out);
    } catch (e) {
        next(e);
    }
}

export async function createDefaultRoomRules(req: Request, res: Response, next: NextFunction) {
    try {
        const out = await createDefaultRoomRulesService({ roomId: req.params.id });
        res.status(201).json(out);
    } catch (e) {
        next(e);
    }
}
