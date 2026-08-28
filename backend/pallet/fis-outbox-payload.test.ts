import {describe, expect, it} from "vitest";
import {decodeFisOutboxPayload} from "./fis-outbox-payload";

describe("FIS outbox payload decoding", () => {
    const syncPayload = {
        fis: 1,
        details: {pallet_id: "PAL-1", project: "PROJECT", model: "MODEL"},
        operator: "OPERATOR",
    };

    it("decodes JSONB returned as an object", () => {
        expect(decodeFisOutboxPayload("SYNC", syncPayload)).toEqual(syncPayload);
    });

    it("decodes JSONB returned as text", () => {
        expect(decodeFisOutboxPayload("SYNC", JSON.stringify(syncPayload))).toEqual(syncPayload);
    });

    it("rejects malformed jobs before calling FIS", () => {
        expect(() => decodeFisOutboxPayload("SYNC", {fis: 1})).toThrow("missing details");
    });
});
