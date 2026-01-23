export function parseYMD(dateStr: string): { y: number; m: number; d: number } {
    const parts = dateStr.split("-");
    const yStr = parts[0];
    const mStr = parts[1];
    const dStr = parts[2];

    if (!yStr || !mStr || !dStr) throw new Error("date inválida");

    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);

    if ([y, m, d].some((n) => Number.isNaN(n))) throw new Error("date inválida");
    if (m < 1 || m > 12 || d < 1 || d > 31) throw new Error("date inválida");

    return { y, m, d };
}

export function buildSlotsForDay(
    dateStr: string,
    openAt: string,
    closeAt: string,
    slotMinutes: number
) {
    const { y, m, d } = parseYMD(dateStr);

    const openParts = openAt.split(":");
    const closeParts = closeAt.split(":");

    const ohStr = openParts[0];
    const omStr = openParts[1];
    const chStr = closeParts[0];
    const cmStr = closeParts[1];

    if (!ohStr || !omStr || !chStr || !cmStr) throw new Error("Horario inválido");

    const oh = Number(ohStr);
    const om = Number(omStr);
    const ch = Number(chStr);
    const cm = Number(cmStr);

    if ([oh, om, ch, cm].some((n) => Number.isNaN(n))) throw new Error("Horario inválido");
    if (!(slotMinutes > 0 && Number.isInteger(slotMinutes))) throw new Error("slotMinutes inválido");

    const startDay = new Date(y, m - 1, d, oh, om, 0, 0);
    const endDay = new Date(y, m - 1, d, ch, cm, 0, 0);

    if (endDay <= startDay) throw new Error("Horario inválido");

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

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && bStart < aEnd;
}
