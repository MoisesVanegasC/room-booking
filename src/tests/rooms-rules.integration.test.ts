import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";

let adminCookie = "";
let roomId = "";
const app = createApp();

describe("rooms rules (integration)", () => {
    beforeAll(async () => {
        // 1) Login como ADMIN (ajusta email/pass al admin que tengas en seed o manual)
        const login = await request(app)
            .post("/auth/login")
            .send({ email: "admin@test.com", password: "admin123" });

        expect(login.status).toBe(200);
        const setCookie = login.headers["set-cookie"];
        expect(setCookie).toBeTruthy();

        adminCookie = setCookie[0].split(";")[0]; // "jwt=..."

        // 2) Crear room
        const roomRes = await request(app)
            .post("/rooms")
            .set("Cookie", adminCookie)
            .send({ name: "Sala Test", capacity: 10, slotMinutes: 60 });

        expect(roomRes.status).toBe(201);
        roomId = roomRes.body.id;
        expect(roomId).toBeTruthy();
    });

    it("POST /rooms/:id/rules/default crea reglas", async () => {
        const res = await request(app)
            .post(`/rooms/${roomId}/rules/default`)
            .set("Cookie", adminCookie)
            .send({});

        expect(res.status).toBe(201);
        expect(res.body.roomId).toBe(roomId);
        expect(res.body.rules.length).toBeGreaterThan(0);
    });

    it("GET /rooms/:id/rules devuelve reglas", async () => {
        const res = await request(app)
            .get(`/rooms/${roomId}/rules`)
            .set("Cookie", adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.roomId).toBe(roomId);
        expect(Array.isArray(res.body.rules)).toBe(true);
    });

    it("USER no puede acceder a rules (403)", async () => {
        // Ajusta a un user real
        const loginUser = await request(app)
            .post("/auth/login")
            .send({ email: "user@test.com", password: "user123" });

        expect(loginUser.status).toBe(200);
        const userCookie = loginUser.headers["set-cookie"][0].split(";")[0];

        const res = await request(app)
            .get(`/rooms/${roomId}/rules`)
            .set("Cookie", userCookie);

        expect(res.status).toBe(403);
    });
});
