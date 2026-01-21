import type { Request, Response, NextFunction } from "express";
import { registerService, loginService } from "../modules/auth/service";

export async function register(req: Request, res: Response, next: NextFunction) {
    try {
        const { user, cookie } = await registerService(req.body);
        res.setHeader("Set-Cookie", cookie);
        res.status(201).json({ user });
    } catch (err) {
        next(err);
    }
}

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { user, cookie } = await loginService(req.body);
        res.setHeader("Set-Cookie", cookie);
        res.status(200).json({ user });
    } catch (err) {
        next(err);
    }
}

export async function logout(_req: Request, res: Response) {
    // borra cookie
    const cookie = `jwt=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`;
    res.setHeader("Set-Cookie", cookie);
    res.status(200).json({ status: "ok" });
}

export async function me(req: any, res: Response) {
    res.status(200).json({ user: req.user });
}
