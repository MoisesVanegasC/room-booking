import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { prisma } from "./config/prisma";
import reservationsRouter from "./modules/reservations/routes";
import authRouter from "./modules/auth/routes";
import roomsRouter from "./modules/rooms/routes";
import adminRouter from "./modules/admin/routes";


export function createApp() {
  const app = express();

  // Middlewares base
  app.use(express.json());
  app.use(cookieParser());

  // CORS: en local
  app.use(
    cors({
      //origin: ["http://localhost:5173"],
      origin: true,
      credentials: true,
    })
  );

  app.use("/reservations", reservationsRouter);
  app.use("/auth", authRouter);
  app.use("/rooms", roomsRouter);
  app.use("/admin", adminRouter);

  // Healthcheck
  app.get("/health", async (_req, res, next) => {
    try {
      const roomsCount = await prisma.room.count();

      return res.status(200).json({
        status: "ok",
        roomsCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  // Error handling middleware
  app.use((err: any, _req: any, res: any, _next: any) => {
    const statusCode = err?.statusCode ?? 500;

    const code =
      err?.code ??
      (statusCode === 400 ? "400 BAD_REQUEST" :
        statusCode === 401 ? "401 UNAUTHORIZED" :
          statusCode === 403 ? "403 FORBIDDEN" :
            statusCode === 404 ? "404 NOT_FOUND" :
              statusCode === 409 ? "409 CONFLICT" :
                "INTERNAL_ERROR");

    const message =
      statusCode === 500
        ? "Internal Server Error"
        : (err?.message ?? "Error");

    res.status(statusCode).json({
      error: { code, message }
    });
  });


  return app;
}

