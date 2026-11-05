import {APIError} from "encore.dev/api";
import {db} from "./db";
import {requirePalletManagementUser} from "../shared/authorization";
import {isFisSafeText} from "../shared/validation";
import {t} from "../shared/i18n";
import {encodeAuditChanges} from "./audit-description";
import {enqueueFisSync} from "./fis-outbox";

export async function updateCatalogItem(
    kind: "project" | "model",
    id: number,
    newNameRaw: string,
    lang?: string,
    projectId?: number,
    expectedProjectId?: number,
): Promise<void> {
    const operator = requirePalletManagementUser().fullName;
    const newName = newNameRaw?.trim();
    if (projectId !== undefined && (kind !== "model" || !Number.isSafeInteger(projectId) || projectId < 1)) {
        throw APIError.invalidArgument(t("project_required", lang));
    }
    if (!Number.isSafeInteger(id) || id < 1) throw APIError.invalidArgument(t("catalog_not_found", lang));
    if (!newName || newName.length > 50 || !isFisSafeText(newName)) {
        throw APIError.invalidArgument(t("catalog_invalid_name", lang));
    }
    try {
        await using tx = await db.begin();
        // Serialize catalogue mutations with pallet creation and FIS snapshot updates.
        await tx.exec`LOCK TABLE projects, pallet_models, pallets IN SHARE ROW EXCLUSIVE MODE`;
        const entry: {name: string; project_id?: number; project?: string} | null = kind === "project"
            ? await tx.queryRow<{name: string}>`SELECT name FROM projects WHERE id = ${id}`
            : await tx.queryRow<{name: string; project_id: number; project: string}>`
                SELECT m.name, m.project_id, p.name AS project FROM pallet_models m
                JOIN projects p ON p.id = m.project_id WHERE m.id = ${id}`;
        if (!entry) throw APIError.notFound(t("catalog_not_found", lang));

        if (projectId !== undefined && entry.project_id !== expectedProjectId) {
            throw APIError.aborted(t("catalog_conflict", lang));
        }
        const targetProject = projectId === undefined ? null
            : await tx.queryRow<{name: string}>`SELECT name FROM projects WHERE id = ${projectId}`;
        if (projectId !== undefined && !targetProject) throw APIError.notFound(t("catalog_not_found", lang));
        const moving = kind === "model" && projectId !== undefined && entry.project_id !== projectId;
        if (newName !== entry.name || moving) {
            // The model FK cascades project changes; record one explicit audit event per pallet.
            if (moving) await tx.exec`SELECT set_config('palletx.report_edit', 'on', true)`;
            if (kind === "project") await tx.exec`UPDATE projects SET name = ${newName} WHERE id = ${id}`;
            else await tx.exec`UPDATE pallet_models SET name = ${newName}, project_id = COALESCE(${projectId ?? null}::int, project_id) WHERE id = ${id}`;
            const affected = await tx.queryAll<{pallet_id: string; project: string; model: string; fis: 1 | 2; deleted_at: Date | null}>`
                SELECT pallet_id, project, model, fis, deleted_at FROM pallet_details
                WHERE (${kind} = 'project' AND project_id = ${id})
                   OR (${kind} = 'model' AND model_id = ${id})
            `;
            const changes: Parameters<typeof encodeAuditChanges>[0] = [];
            if (newName !== entry.name) changes.push({key: "audit_catalog_renamed", variables: {from: entry.name, to: newName}});
            if (moving) changes.push({key: "audit_model_moved", variables: {from: entry.project!, to: targetProject!.name}});
            const description = encodeAuditChanges(changes);
            await tx.exec`INSERT INTO pallet_audit_logs (pallet_id, timestamp, operator_id, previous_status, new_status, description)
                SELECT pallet_id, NOW(), ${operator}, status, status, ${description} FROM pallets
                WHERE (${kind} = 'project' AND project_id = ${id})
                   OR (${kind} = 'model' AND model_id = ${id})`;
            await tx.exec`UPDATE pallets SET updated_at = NOW(), updated_by = ${operator}
                WHERE (${kind} = 'project' AND project_id = ${id})
                   OR (${kind} = 'model' AND model_id = ${id})`;
            for (const row of affected) {
                if (!row.deleted_at) await enqueueFisSync(tx, row.fis, {pallet_id: row.pallet_id, project: row.project, model: row.model}, operator);
            }
        }
        await tx.commit();
    } catch (error) {
        if (error instanceof APIError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("23505") || message.includes("duplicate key")) {
            throw APIError.alreadyExists(t(kind === "project" ? "project_exists" : "model_exists", lang));
        }
        if (message.includes("23503") || message.includes("foreign key")) {
            throw APIError.failedPrecondition(t("catalog_in_use", lang));
        }
        throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
    }
}

export async function deleteCatalogItem(
    kind: "project" | "model",
    id: number,
    lang?: string,
): Promise<void> {
    requirePalletManagementUser();
    if (!Number.isSafeInteger(id) || id < 1) throw APIError.invalidArgument(t("catalog_not_found", lang));
    try {
        await using tx = await db.begin();
        // Serialize catalogue mutations with pallet creation and FIS snapshot updates.
        await tx.exec`LOCK TABLE projects, pallet_models, pallets IN SHARE ROW EXCLUSIVE MODE`;
        const entry = kind === "project"
            ? await tx.queryRow<{name: string}>`SELECT name FROM projects WHERE id = ${id}`
            : await tx.queryRow<{name: string}>`SELECT name FROM pallet_models WHERE id = ${id}`;
        if (!entry) throw APIError.notFound(t("catalog_not_found", lang));

        // Foreign keys protect active and archived pallets as well as child models.
        if (kind === "project") await tx.exec`DELETE FROM projects WHERE id = ${id}`;
        else await tx.exec`DELETE FROM pallet_models WHERE id = ${id}`;

        await tx.commit();
    } catch (error) {
        if (error instanceof APIError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("23503") || message.includes("foreign key")) {
            throw APIError.failedPrecondition(t("catalog_in_use", lang));
        }
        throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
    }
}
