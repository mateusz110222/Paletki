import {describe, expect, it} from "vitest";
import {parseLanguage, t, translations} from "./i18n";
import {
    encodeAuditChanges,
    encodeAuditDescription,
    localizeAuditDescription,
    localizeAuditLog,
} from "./audit-description";

describe("backend translations", () => {
    it("keeps Polish and English dictionaries complete", () => {
        expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.pl).sort());
    });

    it("respects language priorities and regional tags", () => {
        expect(parseLanguage("de;q=0.9, en-US;q=0.8, pl;q=0.7")).toBe("en");
        expect(parseLanguage("pl-PL")).toBe("pl");
    });

    it("interpolates translated variables", () => {
        expect(t("status_invalid", "en", {status: "Unknown"})).toBe("Unsupported pallet status: Unknown.");
    });
});

describe("localized audit descriptions", () => {
    it("localizes encoded descriptions at read time", () => {
        const encoded = encodeAuditDescription("audit_cycle_limit", {maxCycles: 200});
        expect(localizeAuditDescription(encoded, "pl")).toContain("200 cykli");
        expect(localizeAuditDescription(encoded, "en")).toContain("200 cycles");
    });

    it("localizes structured change lists", () => {
        const encoded = encodeAuditChanges([
            {key: "audit_change_nests", variables: {from: 1, to: 2}},
            {key: "audit_change_max_cycles", variables: {from: 100, to: 200}},
        ]);
        expect(localizeAuditDescription(encoded, "en")).toBe(
            "Pallet data changed: nests 1 → 2, cycle limit 100 → 200.",
        );
    });

    it("localizes system operator identifiers", () => {
        const localized = localizeAuditLog({
            id: 1,
            pallet_id: "PAL-1",
            timestamp: new Date(0),
            operator_id: "System_AutoBlock",
            previous_status: "Active",
            new_status: "Washing_Required",
            description: encodeAuditDescription("audit_cycle_limit", {maxCycles: 200}),
        }, "en");
        expect(localized.operator_id).toBe("System – automatic block");
    });
});
