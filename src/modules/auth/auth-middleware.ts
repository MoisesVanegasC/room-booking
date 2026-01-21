import { verifyJwt } from "../../shared/jwt.js";

function parseCookie(cookieHeader?: string) {
    const raw = cookieHeader ?? "";
    const parts = raw.split(";").map(s => s.trim());
    const kv = parts.find(p => p.startsWith("jwt="));
    if (!kv) return null;
    return kv.substring("jwt=".length);
}

export function requireAuth(req: any, _res: any, next: any) {
    try {
        const token = parseCookie(req.headers.cookie);
        if (!token) throw Object.assign(new Error("No autenticado"), { statusCode: 401 });

        const payload = verifyJwt(token);
        req.user = { id: payload.sub, role: payload.role };

        next();
    } catch {
        next(Object.assign(new Error("No autenticado"), { statusCode: 401 }));
    }
}
