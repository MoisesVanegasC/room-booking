import { describe, it, expect } from "vitest";
import { buildSlotsForDay, overlaps } from "../modules/rooms/availability.utils";

describe("availability utils", () => {
    it("buildSlotsForDay genera slots correctos", () => {
        const slots = buildSlotsForDay("2026-01-22", "08:00", "10:00", 60);
        expect(slots).toHaveLength(2);
    });

    it("overlaps detecta traslape", () => {
        const aStart = new Date("2026-01-22T08:00:00Z");
        const aEnd = new Date("2026-01-22T09:00:00Z");
        const bStart = new Date("2026-01-22T08:30:00Z");
        const bEnd = new Date("2026-01-22T10:00:00Z");
        expect(overlaps(aStart, aEnd, bStart, bEnd)).toBe(true);
    });

    it("overlaps no marca traslape cuando toca borde", () => {
        const aStart = new Date("2026-01-22T08:00:00Z");
        const aEnd = new Date("2026-01-22T09:00:00Z");
        const bStart = new Date("2026-01-22T09:00:00Z");
        const bEnd = new Date("2026-01-22T10:00:00Z");
        expect(overlaps(aStart, aEnd, bStart, bEnd)).toBe(false);
    });
});
