import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { TEST_ADMIN, TEST_USER } from "./test-credentials";

let adminCookie = "";
let userCookie = "";
let roomId = "";

describe("rooms rules (integration)", () => {
    const app = createApp();

    beforeAll(async () => {
        // 1) Login ADMIN
        const loginAdmin = await request(app)
            .post("/auth/login")
            .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });

        expect(loginAdmin.status).toBe(200);
        expect(loginAdmin.headers["set-cookie"]).toBeTruthy();
        adminCookie = loginAdmin.headers["set-cookie"][0].split(";")[0];

        // 2) Login USER
        const loginUser = await request(app)
            .post("/auth/login")
            .send({ email: TEST_USER.email, password: TEST_USER.password });

        expect(loginUser.status).toBe(200);
        expect(loginUser.headers["set-cookie"]).toBeTruthy();
        userCookie = loginUser.headers["set-cookie"][0].split(";")[0];

        // 3) (Extra PRO) Confirmar roles vía /auth/me (si existe)
        // Si tu endpoint /auth/me existe, esto valida que el token es correcto.
        const meAdmin = await request(app).get("/auth/me").set("Cookie", adminCookie);
        expect(meAdmin.status).toBe(200);
        expect(meAdmin.body?.user?.role).toBe("ADMIN");

        const meUser = await request(app).get("/auth/me").set("Cookie", userCookie);
        expect(meUser.status).toBe(200);
        expect(meUser.body?.user?.role).toBe("USER");

        // 4) Crear room con ADMIN
        const roomRes = await request(app)
            .post("/rooms")
            .set("Cookie", adminCookie)
            .send({ name: "Sala Test", capacity: 10, slotMinutes: 60 });

        expect(roomRes.status).toBe(201);
        roomId = roomRes.body.id;
        expect(roomId).toBeTruthy();
    });

    it("POST /rooms/:id/rules/default crea reglas (ADMIN)", async () => {
        const res = await request(createApp())
            .post(`/rooms/${roomId}/rules/default`)
            .set("Cookie", adminCookie)
            .send({});

        expect(res.status).toBe(201);
        expect(res.body.roomId).toBe(roomId);
        expect(Array.isArray(res.body.rules)).toBe(true);
        expect(res.body.rules.length).toBeGreaterThan(0);
    });

    it("GET /rooms/:id/rules devuelve reglas (ADMIN)", async () => {
        const res = await request(createApp())
            .get(`/rooms/${roomId}/rules`)
            .set("Cookie", adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.roomId).toBe(roomId);
        expect(Array.isArray(res.body.rules)).toBe(true);
    });

    it("USER no puede acceder a rules (403)", async () => {
        const res = await request(createApp())
            .get(`/rooms/${roomId}/rules`)
            .set("Cookie", userCookie);

        expect(res.status).toBe(403);
    });
});
