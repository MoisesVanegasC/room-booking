import { prisma } from "../config/prisma";

export async function runNoShowSweep() {
    const graceMinutes = 15;
    const threshold = new Date(Date.now() - graceMinutes * 60 * 1000);

    // Pasa a NO_SHOW todas las reservas que ya vencieron y siguen CONFIRMED
    const result = await prisma.reservation.updateMany({
        where: {
            status: "CONFIRMED",
            startAt: { lt: threshold },
        },
        data: { status: "NO_SHOW" },
    });

    return { updated: result.count, threshold: threshold.toISOString() };
}