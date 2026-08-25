import {describe, expect, it} from "vitest";
import {createSessionToken, extractBearerToken, hashSessionToken} from "./session-token";

describe("authentication session tokens", () => {
    it("creates URL-safe tokens with enough entropy", () => {
        const first = createSessionToken();
        const second = createSessionToken();

        expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(second).not.toBe(first);
    });

    it("stores a deterministic SHA-256 hash instead of the raw token", () => {
        const token = createSessionToken();
        const hash = hashSessionToken(token);

        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(hash).not.toContain(token);
        expect(hashSessionToken(token)).toBe(hash);
    });

    it("accepts only a correctly formatted Bearer token", () => {
        const token = createSessionToken();

        expect(extractBearerToken(`Bearer ${token}`)).toBe(token);
        expect(extractBearerToken(`bearer ${token}`)).toBe(token);
        expect(extractBearerToken(token)).toBeNull();
        expect(extractBearerToken("Bearer too-short")).toBeNull();
    });
});
