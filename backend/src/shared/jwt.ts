import "dotenv/config";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

function getJwtSecret(): Secret {
    const s = process.env.JWT_SECRET?.trim();
    if (!s) throw new Error("JWT_SECRET missing in .env");
    return s as Secret;
}

function getExpiresIn(): NonNullable<SignOptions["expiresIn"]> {
    const raw = (process.env.JWT_EXPIRES_IN ?? "1h").trim();
    if (/^\d+$/.test(raw)) return Number(raw);
    return raw as NonNullable<SignOptions["expiresIn"]>;
}

export function signJwt(payload: object): string {
    const secret = getJwtSecret();
    const options: SignOptions = { expiresIn: getExpiresIn() };
    return jwt.sign(payload, secret, options);
}

export function verifyJwt(token: string) {
    const secret = getJwtSecret();
    return jwt.verify(token, secret) as any;
}
