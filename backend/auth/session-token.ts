import {createHash, randomBytes} from "node:crypto";

const TOKEN_BYTES = 32;
const BASE64URL_TOKEN_LENGTH = 43;

export function createSessionToken(): string {
    return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
}

export function extractBearerToken(authorization?: string | null): string | null {
    if (!authorization) return null;

    const match = authorization.match(/^Bearer\s+([A-Za-z0-9_-]+)$/i);
    const token = match?.[1];
    if (!token || token.length !== BASE64URL_TOKEN_LENGTH) return null;
    return token;
}
