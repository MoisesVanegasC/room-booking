import { Router } from "express";
import { requireAuth } from "../../core/auth-middleware";
import { requireAdmin } from "../../core/require-admin";
import { requireRole } from "../../core/role-middleware";
import { listRooms, createRoom, getRoomAvailability, getRoomRules, putRoomRule, createDefaultRoomRules } from "./controller";


const router = Router();

// Rooms
router.get("/", requireAuth, listRooms);
router.post("/", requireAuth, createRoom);

// Availability
router.get("/:id/availability", requireAuth, getRoomAvailability);

// Room rules
router.get("/:id/rules", requireAuth, getRoomRules);
router.put("/:id/rules/:dayOfWeek", requireAuth, putRoomRule);
router.post("/:id/rules/default", requireAuth, createDefaultRoomRules);


export default router;
