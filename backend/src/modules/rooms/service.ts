// src/modules/rooms/service.ts
import { prisma } from "../../config/prisma";

function asUuid(value: unknown): string {
    const s = String(value ?? "").trim();
    const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!s) throw Object.assign(new Error("roomId requerido"), { statusCode: 400 });
    if (!uuid.test(s))
        throw Object.assign(new Error("roomId debe ser UUID válido"), { statusCode: 400 });
    return s;
}

function requireDateOnly(v: unknown) {
    const s = String(v ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        throw Object.assign(new Error("date debe ser YYYY-MM-DD"), {
            statusCode: 400,
            code: "BAD_REQUEST",
        });
    }
    return s;
}

function parseYMD(dateStr: string): { y: number; m: number; d: number } {
    const parts = dateStr.split("-"); // string[]

    const yStr = parts[0];
    const mStr = parts[1];
    const dStr = parts[2];

    if (!yStr || !mStr || !dStr) {
        throw Object.assign(new Error("date inválida"), {
            statusCode: 400,
            code: "BAD_REQUEST",
        });
    }

    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);

    if ([y, m, d].some((n) => Number.isNaN(n))) {
        throw Object.assign(new Error("date inválida"), {
            statusCode: 400,
            code: "BAD_REQUEST",
        });
    }

    if (m < 1 || m > 12 || d < 1 || d > 31) {
        throw Object.assign(new Error("date inválida"), {
            statusCode: 400,
            code: "BAD_REQUEST",
        });
    }

    return { y, m, d };
}

function buildSlotsForDay(
    dateStr: string,
    openAt: string,
    closeAt: string,
    slotMinutes: number
) {
    const { y, m, d } = parseYMD(dateStr);

    const [oh, om] = openAt.split(":").map(Number);
    const [ch, cm] = closeAt.split(":").map(Number);

    if ([oh, om, ch, cm].some((n) => Number.isNaN(n))) {
        throw Object.assign(new Error("Horario de sala inválido"), {
            statusCode: 500,
            code: "INTERNAL_ERROR",
        });
    }

    const startDay = new Date(y, m - 1, d, oh, om, 0, 0);
    const endDay = new Date(y, m - 1, d, ch, cm, 0, 0);

    if (!(slotMinutes > 0 && Number.isInteger(slotMinutes))) {
        throw Object.assign(new Error("slotMinutes inválido"), {
            statusCode: 500,
            code: "INTERNAL_ERROR",
        });
    }

    if (endDay <= startDay) {
        throw Object.assign(new Error("Horario de sala inválido (closeAt <= openAt)"), {
            statusCode: 500,
            code: "INTERNAL_ERROR",
        });
    }

    const slots: { startAt: Date; endAt: Date }[] = [];
    let cur = startDay;

    while (true) {
        const next = new Date(cur.getTime() + slotMinutes * 60 * 1000);
        if (next > endDay) break;
        slots.push({ startAt: cur, endAt: next });
        cur = next;
    }

    return slots;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && bStart < aEnd;
}

export async function getAvailabilityService(input: { roomId: unknown; date: unknown }) {
    const roomId = asUuid(input.roomId);
    const dateStr = requireDateOnly(input.date);

    // Room existe
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, slotMinutes: true, isActive: true },
    });

    if (!room || !room.isActive) {
        throw Object.assign(new Error("Sala no existe"), {
            statusCode: 404,
            code: "NOT_FOUND",
        });
    }

    // Day of week (0=Domingo...6=Sábado)
    const { y, m, d } = parseYMD(dateStr);
    const dayOfWeek = new Date(y, m - 1, d).getDay();

    // Buscar regla del día en RoomRule
    const rule = await prisma.roomRule.findUnique({
        where: {
            roomId_dayOfWeek: {
                roomId,
                dayOfWeek,
            },
        },
        select: { openAt: true, closeAt: true, isClosed: true },
    });

    // Si no hay regla, para un MVP lo tratamos como cerrado
    if (!rule || rule.isClosed) {
        return {
            roomId,
            date: dateStr,
            timezone: "America/Mexico_City",
            dayOfWeek,
            closed: true,
            openAt: null,
            closeAt: null,
            slotMinutes: room.slotMinutes,
            slots: [],
        };
    }

    const openAt = rule.openAt;
    const closeAt = rule.closeAt;

    // Genera slots con la regla
    const slots = buildSlotsForDay(dateStr, openAt, closeAt, room.slotMinutes);

    // Reservas que bloquean (CONFIRMED / IN_PROGRESS)
    const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

    const reservations = await prisma.reservation.findMany({
        where: {
            roomId,
            status: { in: ["CONFIRMED", "IN_PROGRESS"] },
            startAt: { lt: dayEnd },
            endAt: { gt: dayStart },
        },
        select: { startAt: true, endAt: true },
    });

    // Respuesta
    const outSlots = slots.map((s) => {
        const blocked = reservations.some((r) =>
            overlaps(s.startAt, s.endAt, r.startAt, r.endAt)
        );

        return {
            startAt: s.startAt.toISOString(),
            endAt: s.endAt.toISOString(),
            available: !blocked,
        };
    });

    return {
        roomId,
        date: dateStr,
        timezone: "America/Mexico_City",
        dayOfWeek,
        closed: false,
        openAt,
        closeAt,
        slotMinutes: room.slotMinutes,
        slots: outSlots,
    };
}
