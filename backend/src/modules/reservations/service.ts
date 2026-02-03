import { prisma } from "../../config/prisma";
import { Prisma } from "@prisma/client";

type CreateReservationInput = {
    userId: unknown;
    roomId: unknown;
    startAt: unknown;
    endAt: unknown;
};

function asUuid(value: unknown, fieldName = "id"): string {
    const s = String(value ?? "").trim();
    const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!s) throw Object.assign(new Error(`${fieldName} requerido`), { statusCode: 400 });
    if (!uuid.test(s))
        throw Object.assign(new Error(`${fieldName} debe ser UUID válido`), { statusCode: 400 });
    return s;
}

function asDate(value: unknown, fieldName: string): Date {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) {
        throw Object.assign(new Error(`${fieldName} inválido (ISO8601)`), { statusCode: 400 });
    }
    return d;
}

export async function createReservationService(input: CreateReservationInput) {
    // 1) Validaciones básicas
    const userId = asUuid(input.userId, "userId");
    const roomId = asUuid(input.roomId, "roomId");
    const startAt = asDate(input.startAt, "startAt");
    const endAt = asDate(input.endAt, "endAt");

    if (endAt <= startAt) {
        throw Object.assign(new Error("endAt debe ser mayor a startAt"), { statusCode: 400 });
    }

    // opcional: exigir futuro
    const now = new Date();
    if (startAt <= now) {
        throw Object.assign(new Error("startAt debe ser futuro"), { statusCode: 400 });
    }

    // 2) Verificar que la sala exista
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
        throw Object.assign(new Error("Sala no existe"), { statusCode: 404 });
    }

    // 3) Insertar (traslapes los decide Postgres con EXCLUDE)
    try {
        const reservation = await prisma.reservation.create({
            data: {
                userId,
                roomId,
                startAt,
                endAt,
                status: "CONFIRMED",
            },
        });
        return reservation;
    } catch (e: any) {
        // 1) Si el error viene de Postgres EXCLUDE constraint, el mensaje incluye el nombre del constraint
        const msg = String(e?.message ?? "");

        if (msg.includes('reservation_no_overlap_per_room')) {
            throw Object.assign(new Error("La sala ya está reservada en ese horario."), {
                statusCode: 409,
                code: "ROOM_ALREADY_BOOKED",
            });
        }

        // 2) Si es otro error conocido de Prisma
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            throw Object.assign(new Error("Error de base de datos."), { statusCode: 400 });
        }

        throw e;
    }
}

function mustOwnOrAdmin(actor: any, reservationUserId: string) {
    if (actor?.role === "ADMIN") return;
    if (actor?.id !== reservationUserId) {
        throw Object.assign(new Error("No autorizado"), { statusCode: 403, code: "FORBIDDEN" });
    }
}

export async function cancelReservationService(input: {
    reservationId: unknown;
    requester: { id: string; role: "ADMIN" | "USER" };
}) {
    const reservationId = asUuid(input.reservationId, "reservationId");
    const { id: userId, role } = input.requester;

    const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
            id: true,
            userId: true,
            status: true,
            startAt: true,
        },
    });

    if (!reservation) {
        throw Object.assign(new Error("Reserva no existe"), {
            statusCode: 404,
            code: "NOT_FOUND",
        });
    }

    // Permisos
    const isOwner = reservation.userId === userId;
    const isAdmin = role === "ADMIN";
    if (!isOwner && !isAdmin) {
        throw Object.assign(new Error("No autorizado"), {
            statusCode: 403,
            code: "FORBIDDEN",
        });
    }

    // Estados permitidos para cancelar
    if (reservation.status !== "CONFIRMED") {
        throw Object.assign(new Error("Estado inválido para cancelar"), {
            statusCode: 409,
            code: "INVALID_STATE",
        });
    }

    // Regla pro: no cancelar muy tarde (ej. menos de 30 min)
    const MINUTES_BEFORE_START = 30;
    const now = new Date();
    const limit = new Date(reservation.startAt.getTime() - MINUTES_BEFORE_START * 60 * 1000);
    if (now >= limit) {
        throw Object.assign(new Error("Muy tarde para cancelar esta reserva"), {
            statusCode: 409,
            code: "TOO_LATE_TO_CANCEL",
        });
    }

    const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: {
            status: "CANCELLED",
            cancelledAt: new Date(), // si agregaste el campo
        },
        select: { id: true, status: true, cancelledAt: true },
    });

    return updated;
}

export async function checkInService(input: { reservationId: unknown; actor: any }) {
    const reservationId = asUuid(input.reservationId, "reservationId");

    const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!r) {
        throw Object.assign(new Error("Reserva no existe"), { statusCode: 404, code: "NOT_FOUND" });
    }

    mustOwnOrAdmin(input.actor, r.userId);

    if (r.status !== "CONFIRMED") {
        throw Object.assign(new Error("Estado inválido para check-in"), {
            statusCode: 409,
            code: "INVALID_STATE",
        });
    }

    // Ventana +/- 15 min basada en startAt
    const now = new Date();
    const early = new Date(r.startAt.getTime() - 15 * 60 * 1000);
    const late = new Date(r.startAt.getTime() + 15 * 60 * 1000);

    if (now < early) {
        throw Object.assign(new Error("Aún es temprano para check-in"), {
            statusCode: 409,
            code: "CHECKIN_TOO_EARLY",
        });
    }

    if (now > late) {
        throw Object.assign(new Error("Ventana de check-in expirada"), {
            statusCode: 410,
            code: "CHECKIN_WINDOW_EXPIRED",
        });
    }

    const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: "IN_PROGRESS" },
        select: {
            id: true,
            status: true,
            roomId: true,
            userId: true,
            startAt: true,
            endAt: true,
        },
    });

    return updated;
}

export async function checkOutService(input: { reservationId: unknown; actor: any }) {
    const reservationId = asUuid(input.reservationId);

    const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!r) {
        throw Object.assign(new Error("Reserva no existe"), { statusCode: 404, code: "NOT_FOUND" });
    }

    mustOwnOrAdmin(input.actor, r.userId);

    if (r.status !== "IN_PROGRESS") {
        throw Object.assign(new Error("Estado inválido para check-out"), {
            statusCode: 409,
            code: "INVALID_STATE",
        });
    }

    const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: "FINISHED" },
        select: {
            id: true,
            status: true,
            roomId: true,
            userId: true,
            startAt: true,
            endAt: true,
        },
    });

    return updated;
}