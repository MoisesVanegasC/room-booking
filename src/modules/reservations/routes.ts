import { Router } from "express";
import { requireAuth } from "../auth/auth-middleware";
import { checkInReservation, checkOutReservation, createReservation, myReservations } from "./controller";


const router = Router();

router.post("/", requireAuth, createReservation);
router.get("/me", requireAuth, myReservations);

router.patch("/:id/check-in", requireAuth, checkInReservation);
router.patch("/:id/check-out", requireAuth, checkOutReservation);


export default router;
