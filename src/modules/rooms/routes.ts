import { Router } from "express";
import { requireAuth } from "../../core/auth-middleware";
import { requireRole } from "../../core/role-middleware";
import { listRooms, createRoom, getRoomAvailability } from "./controller";


const router = Router();

router.get("/", listRooms);
router.get("/:id/availability", requireAuth, getRoomAvailability);
router.post("/", requireAuth, requireRole("ADMIN"), createRoom);

export default router;
