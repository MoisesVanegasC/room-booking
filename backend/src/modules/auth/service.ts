import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma";
import { signJwt } from "../../shared/jwt"; // lo creamos abajo

type RegisterInput = { email?: unknown; password?: unknown };
type LoginInput = { email?: unknown; password?: unknown };

function normalizeEmail(v: unknown) {
    const email = String(v ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw Object.assign(new Error("Email inválido"), { statusCode: 400 });
    return email;
}

function normalizePassword(v: unknown) {
    const pass = String(v ?? "");
    if (pass.length < 8) throw Object.assign(new Error("Password mínimo 8 caracteres"), { statusCode: 400 });
    return pass;
}

function buildCookie(token: string) {
    const secure = process.env.COOKIE_SECURE === "true";
    return [
        `jwt=${token}`,
        "HttpOnly",
        "Path=/",
        "SameSite=Strict",
        secure ? "Secure" : "",
    ].filter(Boolean).join("; ");
}

export async function registerService(input: RegisterInput) {
    const email = normalizeEmail(input.email);
    const password = normalizePassword(input.password);

    const passwordHash = await bcrypt.hash(password, 12);

    try {
        const user = await prisma.user.create({
        data: { email, passwordHash },
        select: { id: true, email: true, role: true, createdAt: true },
        });

        const token = signJwt({ sub: user.id, role: user.role });
        const cookie = buildCookie(token);

        return { user, cookie };
    } catch (e: any) {
        const msg = String(e?.message ?? "").toLowerCase();
        if (msg.includes("unique") || msg.includes("duplicate")) {
            throw Object.assign(new Error("Email ya registrado"), { statusCode: 409 });
        }
        throw e;
    }
}

export async function loginService(input: LoginInput) {
    const email = normalizeEmail(input.email);
    const password = normalizePassword(input.password);

    const userDb = await prisma.user.findUnique({ where: { email } });
    if (!userDb) throw Object.assign(new Error("Credenciales inválidas"), { statusCode: 401 });

    const ok = await bcrypt.compare(password, userDb.passwordHash);
    if (!ok) throw Object.assign(new Error("Credenciales inválidas"), { statusCode: 401 });

    const user = { id: userDb.id, email: userDb.email, role: userDb.role, createdAt: userDb.createdAt };

    const token = signJwt({ sub: userDb.id, role: userDb.role });
    const cookie = buildCookie(token);

    return { user, cookie };
}
