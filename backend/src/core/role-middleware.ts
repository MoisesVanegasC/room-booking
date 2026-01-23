import { log } from "../shared/logger";

export function requireRole(role: "ADMIN" | "USER") {
    return (req: any, _res: any, next: any) => {
        //console.log("[ROLE] expected:", role, "got:", req.user?.role); // << CLAVE
        log("[ROLE] expected:", role, "got:", req.user?.role);

        if (!req.user) return next(Object.assign(new Error("No autenticado"), { statusCode: 401 }));
        if (req.user.role !== role) return next(Object.assign(new Error("No autorizado"), { statusCode: 403 }));
        next();
    };
}

