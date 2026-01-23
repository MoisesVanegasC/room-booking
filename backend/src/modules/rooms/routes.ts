import { Router } from "express";
import { requireAuth } from "../../core/auth-middleware";
import { requireRole } from "../../core/role-middleware";
import { listRooms, createRoom, getRoomAvailability, getRoomRules, putRoomRule, createDefaultRoomRules } from "./controller";


const router = Router();

// Rooms
router.get("/", requireAuth, listRooms);
router.post("/", requireAuth, createRoom);

// Availability
router.get("/:id/availability", requireAuth, getRoomAvailability);

// Room rules
router.get("/:id/rules", requireAuth, requireRole("ADMIN"), getRoomRules);
router.put("/:id/rules/:dayOfWeek", requireAuth, requireRole("ADMIN"), putRoomRule);
router.post("/:id/rules/default", requireAuth, requireRole("ADMIN"), createDefaultRoomRules);


export default router;
