import { Router } from "express";
import { register, login, logout, me } from "../../core/controller";
import { requireAuth } from "../auth/auth-middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
