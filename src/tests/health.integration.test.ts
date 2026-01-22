import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";

describe("health (integration)", () => {
    it("GET /health returns ok", async () => {
        const app = createApp();
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(typeof res.body.roomsCount).toBe("number");
    });
});
