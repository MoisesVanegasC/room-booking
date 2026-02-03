import { Router } from "express";
import { requireAuth } from "../../core/auth-middleware";
import { checkInReservation, checkOutReservation, createReservation, myReservations, cancelReservation } from "./controller";


const router = Router();

router.post("/", requireAuth, createReservation);
router.get("/me", requireAuth, myReservations);

router.patch("/:id/check-in", requireAuth, checkInReservation);
router.patch("/:id/check-out", requireAuth, checkOutReservation);

router.delete("/:id", requireAuth, cancelReservation);

export default router;
