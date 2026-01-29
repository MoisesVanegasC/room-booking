import { Router } from "express";
import { register, login, logout, me } from "../../core/controller";
import { requireAuth } from "../../core/auth-middleware";
import { prisma } from "../../config/prisma";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, async (req: any, res, next) => {
    try {
        const userId = req.user?.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, role: true },
        });

        if (!user) {
            // token válido pero usuario ya no existe
            throw Object.assign(new Error("No autenticado"), { statusCode: 401 });
        }

        return res.json({ user }); // ✅ ahora incluye email
    } catch (e) {
        next(e);
    }
});

export default router;
