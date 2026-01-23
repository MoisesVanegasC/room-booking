import { prisma } from "../../config/prisma";

function asUuid(value: unknown): string {
    const s = String(value ?? "").trim();
    const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!s) throw Object.assign(new Error("roomId requerido"), { statusCode: 400 });
    if (!uuid.test(s)) throw Object.assign(new Error("roomId debe ser UUID válido"), { statusCode: 400 });
    return s;
}

function asDayOfWeek(v: unknown): number {
    const n = Number(String(v ?? "").trim());
    if (!Number.isInteger(n) || n < 0 || n > 6) {
        throw Object.assign(new Error("dayOfWeek debe ser 0..6"), { statusCode: 400, code: "BAD_REQUEST" });
    }
    return n;
}

function asHHMM(v: unknown, field: string): string {
    const s = String(v ?? "").trim();

    if (!/^\d{2}:\d{2}$/.test(s)) {
        throw Object.assign(new Error(`${field} debe ser HH:MM`), {
            statusCode: 400,
            code: "BAD_REQUEST",
        });
    }

    const parts = s.split(":");
    const hStr = parts[0];
    const mStr = parts[1];

    if (!hStr || !mStr) {
        throw Object.assign(new Error(`${field} inválido`), {
            statusCode: 400,
            code: "BAD_REQUEST",
        });
    }

    const h = Number(hStr);
    const m = Number(mStr);

    if (Number.isNaN(h) || Number.isNaN(m)) {
        throw Object.assign(new Error(`${field} inválido`), {
            statusCode: 400,
            code: "BAD_REQUEST",
        });
    }

    if (h < 0 || h > 23 || m < 0 || m > 59) {
        throw Object.assign(new Error(`${field} fuera de rango`), {
            statusCode: 400,
            code: "BAD_REQUEST",
        });
    }

    return s;
}

export async function getRoomRulesService(input: { roomId: unknown }) {
    const roomId = asUuid(input.roomId);

    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
    if (!room) throw Object.assign(new Error("Sala no existe"), { statusCode: 404, code: "NOT_FOUND" });

    const rules = await prisma.roomRule.findMany({
        where: { roomId },
        orderBy: { dayOfWeek: "asc" },
        select: { dayOfWeek: true, openAt: true, closeAt: true, isClosed: true },
    });

    return { roomId, rules };
}

export async function upsertRoomRuleService(input: {
    roomId: unknown;
    dayOfWeek: unknown;
    openAt: unknown;
    closeAt: unknown;
    isClosed: unknown;
}) {
    const roomId = asUuid(input.roomId);
    const dayOfWeek = asDayOfWeek(input.dayOfWeek);
    const isClosed = Boolean(input.isClosed);

    const openAt = isClosed ? "00:00" : asHHMM(input.openAt, "openAt");
    const closeAt = isClosed ? "00:00" : asHHMM(input.closeAt, "closeAt");

    if (!isClosed && openAt >= closeAt) {
        throw Object.assign(new Error("openAt debe ser menor a closeAt"), { statusCode: 400, code: "BAD_REQUEST" });
    }

    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
    if (!room) throw Object.assign(new Error("Sala no existe"), { statusCode: 404, code: "NOT_FOUND" });

    const rule = await prisma.roomRule.upsert({
        where: { roomId_dayOfWeek: { roomId, dayOfWeek } },
        update: { isClosed, openAt, closeAt },
        create: { roomId, dayOfWeek, isClosed, openAt, closeAt },
        select: { roomId: true, dayOfWeek: true, isClosed: true, openAt: true, closeAt: true },
    });

    return rule;
}

export async function createDefaultRoomRulesService(input: { roomId: unknown }) {
    const roomId = asUuid(input.roomId);

    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
    if (!room) throw Object.assign(new Error("Sala no existe"), { statusCode: 404, code: "NOT_FOUND" });

    await prisma.roomRule.upsert({
        where: { roomId_dayOfWeek: { roomId, dayOfWeek: 0 } },
        update: { isClosed: true, openAt: "00:00", closeAt: "00:00" },
        create: { roomId, dayOfWeek: 0, isClosed: true, openAt: "00:00", closeAt: "00:00" },
    });

    for (let dow = 1; dow <= 5; dow++) {
        await prisma.roomRule.upsert({
            where: { roomId_dayOfWeek: { roomId, dayOfWeek: dow } },
            update: { isClosed: false, openAt: "08:00", closeAt: "20:00" },
            create: { roomId, dayOfWeek: dow, isClosed: false, openAt: "08:00", closeAt: "20:00" },
        });
    }

    await prisma.roomRule.upsert({
        where: { roomId_dayOfWeek: { roomId, dayOfWeek: 6 } },
        update: { isClosed: false, openAt: "10:00", closeAt: "14:00" },
        create: { roomId, dayOfWeek: 6, isClosed: false, openAt: "10:00", closeAt: "14:00" },
    });

    const rules = await prisma.roomRule.findMany({
        where: { roomId },
        orderBy: { dayOfWeek: "asc" },
        select: { dayOfWeek: true, openAt: true, closeAt: true, isClosed: true },
    });

    return { roomId, rules };
}
