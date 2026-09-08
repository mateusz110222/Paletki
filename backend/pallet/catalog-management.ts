import {api, APIError, Header} from "encore.dev/api";
import {db} from "./db";
import {requirePalletManagementUser} from "../shared/authorization";
import {isFisSafeText, type ShortText} from "../shared/validation";
import {t} from "../shared/i18n";
import {enqueueFisSync} from "./fis-outbox";

export interface ManageCatalogParams {
    kind: "project" | "model";
    id: number;
    newName?: ShortText;
    acceptLanguage?: Header<"Accept-Language">;
}

export const ManageCatalog = api(
    {method: "POST", path: "/catalog/manage", expose: true, auth: true},
    async (params: ManageCatalogParams): Promise<void> => {
        const operator = requirePalletManagementUser().fullName;
        const lang = params.acceptLanguage;
        const newName = params.newName?.trim();
        if (!Number.isSafeInteger(params.id) || params.id < 1) throw APIError.invalidArgument(t("catalog_not_found", lang));
        if (params.newName !== undefined && (!newName || newName.length > 50 || !isFisSafeText(newName))) {
            throw APIError.invalidArgument(t("catalog_invalid_name", lang));
        }
        try {
            await using tx = await db.begin();
            // Serialize catalogue mutations with pallet creation and FIS snapshot updates.
            await tx.exec`LOCK TABLE projects, pallet_models, pallets IN SHARE ROW EXCLUSIVE MODE`;
            const entry = params.kind === "project"
                ? await tx.queryRow<{name: string}>`SELECT name FROM projects WHERE id = ${params.id}`
                : await tx.queryRow<{name: string}>`SELECT name FROM pallet_models WHERE id = ${params.id}`;
            if (!entry) throw APIError.notFound(t("catalog_not_found", lang));
            if (newName === undefined) {
                // Foreign keys protect active and archived pallets as well as child models.
                if (params.kind === "project") await tx.exec`DELETE FROM projects WHERE id = ${params.id}`;
                else await tx.exec`DELETE FROM pallet_models WHERE id = ${params.id}`;
            } else if (newName !== entry.name) {
                if (params.kind === "project") await tx.exec`UPDATE projects SET name = ${newName} WHERE id = ${params.id}`;
                else await tx.exec`UPDATE pallet_models SET name = ${newName} WHERE id = ${params.id}`;
                const affected = await tx.queryAll<{pallet_id: string; project: string; model: string; fis: 1 | 2; deleted_at: Date | null}>`
                    SELECT pallet_id, project, model, fis, deleted_at FROM pallet_details
                    WHERE (${params.kind} = 'project' AND project_id = ${params.id})
                       OR (${params.kind} = 'model' AND model_id = ${params.id})
                `;
                const description = `i18n:${JSON.stringify({key: "audit_catalog_renamed", variables: {from: entry.name, to: newName}})}`;
                await tx.exec`INSERT INTO pallet_audit_logs (pallet_id, timestamp, operator_id, previous_status, new_status, description)
                    SELECT pallet_id, NOW(), ${operator}, status, status, ${description} FROM pallets
                    WHERE (${params.kind} = 'project' AND project_id = ${params.id})
                       OR (${params.kind} = 'model' AND model_id = ${params.id})`;
                await tx.exec`UPDATE pallets SET updated_at = NOW(), updated_by = ${operator}
                    WHERE (${params.kind} = 'project' AND project_id = ${params.id})
                       OR (${params.kind} = 'model' AND model_id = ${params.id})`;
                for (const row of affected) {
                    if (!row.deleted_at) await enqueueFisSync(tx, row.fis, {pallet_id: row.pallet_id, project: row.project, model: row.model}, operator);
                }
            }
            await tx.commit();
        } catch (error) {
            if (error instanceof APIError) throw error;
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("23505") || message.includes("duplicate key")) {
                throw APIError.alreadyExists(t(params.kind === "project" ? "project_exists" : "model_exists", lang));
            }
            if (message.includes("23503") || message.includes("foreign key")) {
                throw APIError.failedPrecondition(t("catalog_in_use", lang));
            }
            throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
        }
    },
);
