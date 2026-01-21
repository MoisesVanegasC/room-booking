import { Router } from "express";
import { requireAuth } from "../../modules/auth/auth-middleware";
import { requireRole } from "../../core/role-middleware";
import { listRooms, createRoom } from "./controller";

const router = Router();

router.get("/", listRooms);
router.post("/", requireAuth, requireRole("ADMIN"), createRoom);

export default router;
