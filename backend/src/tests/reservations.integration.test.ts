import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { TEST_ADMIN, TEST_USER } from "./test-credentials";

let adminCookie = "";
let userCookie = "";
let roomId = "";
let reservationId = "";
let bookingRoomId = "";
let realtimeRoomId = "";
let checkoutRoomId = "";

describe("reservations (integration)", () => {
    const app = createApp();

    beforeAll(async () => {
        // Login admin
        const loginAdmin = await request(app).post("/auth/login").send(TEST_ADMIN);
        expect(loginAdmin.status).toBe(200);
        adminCookie = loginAdmin.headers["set-cookie"][0].split(";")[0];

        // Login user
        const loginUser = await request(app).post("/auth/login").send(TEST_USER);
        expect(loginUser.status).toBe(200);
        userCookie = loginUser.headers["set-cookie"][0].split(";")[0];

        // Crear una sala con admin (para no depender de seed de rooms)
        const room1 = await request(app)
            .post("/rooms")
            .set("Cookie", adminCookie)
            .send({ name: "Sala Booking Test", capacity: 10, slotMinutes: 60 });

        expect(room1.status).toBe(201);
        bookingRoomId = room1.body.id;

        // Room 2: para realtime test
        const room2 = await request(app)
            .post("/rooms")
            .set("Cookie", adminCookie)
            .send({ name: "Sala Realtime Test", capacity: 10, slotMinutes: 60 });

        expect(room2.status).toBe(201);
        realtimeRoomId = room2.body.id;

        // Room 3: para checkout test
        const room3 = await request(app)
            .post("/rooms")
            .set("Cookie", adminCookie)
            .send({ name: "Sala Checkout Test", capacity: 10, slotMinutes: 60 });

        expect(room3.status).toBe(201);
        checkoutRoomId = room3.body.id;

        expect(bookingRoomId).toBeTruthy();
        expect(realtimeRoomId).toBeTruthy();
        expect(checkoutRoomId).toBeTruthy();
    });

    it("POST /reservations crea reserva (201)", async () => {
        // Usa hora futura relativa para que no truene por "startAt debe ser futuro"
        const start = new Date(Date.now() + 60 * 60 * 1000); // +1h
        const end = new Date(start.getTime() + 60 * 60 * 1000); // +2h total

        const res = await request(app)
            .post("/reservations")
            .set("Cookie", userCookie) // reserva como USER (más real)
            .send({
                roomId: bookingRoomId,
                startAt: start.toISOString(),
                endAt: end.toISOString(),
            });

        expect(res.status).toBe(201);
        expect(res.body.id).toBeTruthy();
        expect(res.body.roomId).toBe(bookingRoomId);
        expect(res.body.status).toBeTruthy();

        reservationId = res.body.id;
    });

    it("POST /reservations con traslape devuelve 409", async () => {
        const start = new Date(Date.now() + 60 * 60 * 1000); // mismo rango que arriba
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        const res = await request(app)
            .post("/reservations")
            .set("Cookie", userCookie)
            .send({
                roomId: bookingRoomId,
                startAt: start.toISOString(),
                endAt: end.toISOString(),
            });

        expect(res.status).toBe(409);
    });

    it("PATCH /reservations/:id/check-in cambia a IN_PROGRESS (200)", async () => {
        // OJO: Ventana de check-in.
        // Vamos a crear una reserva que inicie "ahora + 5min",
        // y asumimos tolerancia de -15min..+15min.
        const start = new Date(Date.now() + 5 * 60 * 1000); // +5 min
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        const create = await request(app)
            .post("/reservations")
            .set("Cookie", userCookie)
            .send({
                roomId: realtimeRoomId,
                startAt: start.toISOString(),
                endAt: end.toISOString(),
            });

        expect(create.status).toBe(201);
        const id = create.body.id;

        const checkIn = await request(app)
            .patch(`/reservations/${id}/check-in`)
            .set("Cookie", userCookie)
            .send({});

        expect(checkIn.status).toBe(200);
        expect(checkIn.body.status).toBe("IN_PROGRESS");
    });

    it("PATCH /reservations/:id/check-out cambia a FINISHED (200)", async () => {
        // Reutilizamos el reservationId
        // pero puede estar CONFIRMED. Para no depender del orden,
        // creamos una nueva reserva, hacemos check-in y luego check-out.
        const start = new Date(Date.now() + 5 * 60 * 1000);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        const create = await request(app)
            .post("/reservations")
            .set("Cookie", userCookie)
            .send({
                roomId: checkoutRoomId,
                startAt: start.toISOString(),
                endAt: end.toISOString(),
            });

        expect(create.status).toBe(201);
        const id = create.body.id;

        const checkIn = await request(app)
            .patch(`/reservations/${id}/check-in`)
            .set("Cookie", userCookie)
            .send({});

        expect(checkIn.status).toBe(200);

        const checkOut = await request(app)
            .patch(`/reservations/${id}/check-out`)
            .set("Cookie", userCookie)
            .send({});

        expect(checkOut.status).toBe(200);
        expect(checkOut.body.status).toBe("FINISHED");

    });

    it("Seguridad: ignora userId enviado por el cliente", async () => {
        // Si endpoint no permite userId en body, igual debe ignorarlo (o 400).
        const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        const res = await request(app)
            .post("/reservations")
            .set("Cookie", userCookie)
            .send({
                roomId: bookingRoomId,
                startAt: start.toISOString(),
                endAt: end.toISOString(),
                userId: "00000000-0000-0000-0000-000000000000", // intento malicioso
            });

        // Dos resultados aceptables:
        // A) 201 pero asigna al user real (recomendado)
        // B) 400 porque body tiene campo no permitido (válido)
        expect([201, 400].includes(res.status)).toBe(true);

        if (res.status === 201) {
            // Si devuelve userId, valida que NO sea el del atacante.
            if (res.body.userId) {
                expect(res.body.userId).not.toBe("00000000-0000-0000-0000-000000000000");
            }
        }
    });
});
