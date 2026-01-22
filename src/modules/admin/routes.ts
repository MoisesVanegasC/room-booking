import { Router } from "express";
import { requireAuth } from "../../core/auth-middleware";
import { requireRole } from "../../core/role-middleware";
import { listReservations } from "./controller";

const router = Router();

router.get("/reservations", requireAuth, requireRole("ADMIN"), listReservations);

export default router;
