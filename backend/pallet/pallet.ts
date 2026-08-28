import {api, APIError, Header, Query} from "encore.dev/api";
import type {Max, Min} from "encore.dev/validate";
import {db} from "./db";
import {AuditLog, Pallet, PALLET_STATUSES, PalletStatus} from "../shared/types";
import {t} from "../shared/i18n";
import {
    encodeAuditChanges,
    encodeAuditDescription,
    localizeAuditLog,
} from "./audit-description";
import {requirePalletManagementUser} from "../shared/authorization";
import {
    type FisUnit,
    type MaxCycles,
    type NestCount,
    type PalletID,
    type ShortText,
    isFisSafeText,
    isSafePositiveInteger,
    normalizePalletId,
} from "../shared/validation";
import {type AuditLogRecord, type PalletRecord, toPalletDTO} from "./models";
import {enqueueFisDelete, enqueueFisMigration, enqueueFisSync} from "./fis-outbox";

interface LocalizedRequest {
    acceptLanguage?: Header<"Accept-Language">;
}

export interface GetAllPalletsResponse {
    pallets: Pallet[];
    next_cursor?: number;
}

interface GetPalletParams extends LocalizedRequest {
    pallet_id: string;
}

interface GetPalletHistoryParams extends LocalizedRequest {
    pallet_id: string;
    history_limit?: Query<number & Min<1> & Max<200>>;
    history_before_id?: Query<number & Min<1>>;
}

export interface GetPalletResponse {
    pallet: Pallet;
}

interface PalletPageParams extends LocalizedRequest {
    limit?: Query<number & Min<1> & Max<200>>;
    after_id?: Query<number & Min<0>>;
    query?: Query<string>;
    project?: Query<string>;
    model?: Query<string>;
    status?: Query<string>;
}

interface AuditPageParams extends LocalizedRequest {
    limit?: Query<number & Min<1> & Max<500>>;
    before_id?: Query<number & Min<1>>;
}

interface AddPalletParams extends LocalizedRequest {
    pallet_id: PalletID;
    project: ShortText;
    model: ShortText;
    max_cycles: MaxCycles;
    nests: NestCount;
    status: PalletStatus;
    block_reason?: string | null;
    fis: FisUnit;
}

export interface AddPalletResponse {
    status: boolean;
    pallet_id: string;
}

interface UpdatePalletParams extends LocalizedRequest {
    pallet_id: string;
    fis?: FisUnit | null;
    nests?: NestCount | null;
    max_cycles?: MaxCycles | null;
    status?: PalletStatus | null;
    block_reason?: string | null;
}

interface DeletePalletParams extends LocalizedRequest {
    pallet_id: string;
}

export interface UpdatePalletResponse {
    status: boolean;
    pallet_id: string;
}

export interface DeletePalletResponse extends UpdatePalletResponse {
    message: string;
}

interface AuditHistoryResponse {
    history: AuditLog[];
    next_cursor?: number;
}

export type GetPalletHistoryResponse = AuditHistoryResponse;

function isPalletStatus(status: string): status is PalletStatus {
    return PALLET_STATUSES.includes(status as PalletStatus);
}

export const GetAllPallets = api(
    {method: "GET", path: "/pallets", expose: true, auth: true},
    async (params: PalletPageParams): Promise<GetAllPalletsResponse> => {
        const limit = params.limit ?? 200;
        const afterId = params.after_id ?? null;
        const searchPattern = params.query ? `%${params.query.trim().toUpperCase()}%` : null;
        const project = params.project && params.project !== "ALL" ? params.project : null;
        const model = params.model && params.model !== "ALL" ? params.model : null;
        const status = params.status && params.status !== "ALL" ? params.status : null;

        const rows = await db.queryAll<PalletRecord>`
            SELECT * FROM pallets
            WHERE deleted_at IS NULL
              AND (${afterId}::bigint IS NULL OR id > ${afterId})
              AND (${project}::text IS NULL OR project = ${project})
              AND (${model}::text IS NULL OR model = ${model})
              AND (${status}::text IS NULL OR status = ${status})
              AND (${searchPattern}::text IS NULL OR (
                  UPPER(pallet_id) LIKE ${searchPattern} OR
                  UPPER(model) LIKE ${searchPattern} OR
                  UPPER(created_by) LIKE ${searchPattern}
              ))
            ORDER BY id
            LIMIT ${limit + 1}
        `;
        const hasMore = rows.length > limit;
        return {
            pallets: rows.slice(0, limit).map(toPalletDTO),
            next_cursor: hasMore ? rows[limit - 1]?.id : undefined,
        };
    },
);

export const GetPallet = api(
    {method: "GET", path: "/pallets/:pallet_id", expose: true, auth: true},
    async (params: GetPalletParams): Promise<GetPalletResponse> => {
        const palletId = normalizePalletId(params.pallet_id);
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", params.acceptLanguage));

        const pallet = await db.queryRow<PalletRecord>`
            SELECT * FROM pallets WHERE pallet_id = ${palletId} AND deleted_at IS NULL
        `;
        if (!pallet) throw APIError.notFound(t("pallet_not_found", params.acceptLanguage));

        return {pallet: toPalletDTO(pallet)};
    },
);

export const GetPalletHistory = api(
    {method: "GET", path: "/pallets/:pallet_id/history", expose: true, auth: true},
    async (params: GetPalletHistoryParams): Promise<GetPalletHistoryResponse> => {
        requirePalletManagementUser();
        const palletId = normalizePalletId(params.pallet_id);
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", params.acceptLanguage));

        const exists = await db.queryRow<{exists: boolean}>`
            SELECT EXISTS(SELECT 1 FROM pallets WHERE pallet_id = ${palletId}) AS exists
        `;
        if (!exists?.exists) throw APIError.notFound(t("pallet_not_found", params.acceptLanguage));

        const limit = params.history_limit ?? 200;
        const rows = params.history_before_id === undefined
            ? await db.queryAll<AuditLogRecord>`
                SELECT * FROM pallet_audit_logs
                WHERE pallet_id = ${palletId}
                ORDER BY id DESC LIMIT ${limit + 1}
            `
            : await db.queryAll<AuditLogRecord>`
                SELECT * FROM pallet_audit_logs
                WHERE pallet_id = ${palletId} AND id < ${params.history_before_id}
                ORDER BY id DESC LIMIT ${limit + 1}
            `;
        const hasMore = rows.length > limit;
        return {
            history: rows.slice(0, limit).map((log) => localizeAuditLog(log, params.acceptLanguage)),
            next_cursor: hasMore ? rows[limit - 1]?.id : undefined,
        };
    },
);

export const GetAllPalletHistory = api(
    {method: "GET", path: "/pallets/audit-history", expose: true, auth: true},
    async (params: AuditPageParams): Promise<AuditHistoryResponse> => {
        requirePalletManagementUser();
        const limit = params.limit ?? 500;
        const rows = params.before_id === undefined
            ? await db.queryAll<AuditLogRecord>`
                SELECT * FROM pallet_audit_logs ORDER BY id DESC LIMIT ${limit + 1}
            `
            : await db.queryAll<AuditLogRecord>`
                SELECT * FROM pallet_audit_logs
                WHERE id < ${params.before_id}
                ORDER BY id DESC LIMIT ${limit + 1}
            `;
        const hasMore = rows.length > limit;
        return {
            history: rows.slice(0, limit).map((log) => localizeAuditLog(log, params.acceptLanguage)),
            next_cursor: hasMore ? rows[limit - 1]?.id : undefined,
        };
    },
);

export const AddPallet = api(
    {method: "POST", path: "/pallets", expose: true, auth: true},
    async (params: AddPalletParams): Promise<AddPalletResponse> => {
        const lang = params.acceptLanguage;
        const palletId = normalizePalletId(params.pallet_id);
        const project = params.project?.trim();
        const model = params.model?.trim();
        const fis = params.fis;
        const status = params.status;
        const operator = requirePalletManagementUser().fullName;

        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", lang));
        if (!project) throw APIError.invalidArgument(t("project_required", lang));
        if (!model) throw APIError.invalidArgument(t("model_required", lang));
        if (fis !== 1 && fis !== 2) throw APIError.invalidArgument(t("fis_unsupported", lang));
        if (!isFisSafeText(project) || !isFisSafeText(model)) {
            throw APIError.invalidArgument(t("fis_text_invalid", lang));
        }
        if (!isPalletStatus(status)) throw APIError.invalidArgument(t("status_invalid", lang, {status}));
        if (status === "Blocked" && !params.block_reason?.trim()) {
            throw APIError.invalidArgument(t("block_reason_required", lang));
        }
        if (!isSafePositiveInteger(params.max_cycles) || !isSafePositiveInteger(params.nests)) {
            throw APIError.invalidArgument(t("integer_required", lang));
        }

        const projectExists = await db.queryRow<{exists: boolean}>`
            SELECT EXISTS(SELECT 1 FROM projects WHERE LOWER(name) = LOWER(${project})) AS exists
        `;
        if (!projectExists?.exists) throw APIError.invalidArgument(t("project_required", lang));

        try {
            await using tx = await db.begin();
            const existing = await tx.queryRow<PalletRecord>`
                SELECT * FROM pallets WHERE pallet_id = ${palletId} FOR UPDATE
            `;

            if (existing) {
                if (existing.deleted_at === null) {
                    throw APIError.alreadyExists(t("pallet_exists", lang));
                }

                await tx.exec`
                    UPDATE pallets
                    SET project = ${project},
                        model = ${model},
                        max_cycles = ${params.max_cycles},
                        current_cycles = 0,
                        total_cycles = 0,
                        nests = ${params.nests},
                        status = ${status},
                        block_reason = ${params.block_reason?.trim() ?? null},
                        fis = ${fis},
                        created_at = NOW(),
                        created_by = ${operator},
                        updated_at = NOW(),
                        updated_by = ${operator},
                        deleted_at = NULL,
                        deleted_by = NULL,
                        last_operation_description = ${encodeAuditDescription("audit_registered")}
                    WHERE pallet_id = ${palletId}
                `;
            } else {
                await tx.exec`
                    INSERT INTO pallets (
                        pallet_id, project, model, max_cycles, nests, status, block_reason,
                        fis, created_by, updated_by, last_operation_description
                    ) VALUES (
                        ${palletId}, ${project}, ${model}, ${params.max_cycles}, ${params.nests}, ${status},
                        ${params.block_reason?.trim() ?? null}, ${fis}, ${operator}, ${operator},
                        ${encodeAuditDescription("audit_registered")}
                    )
                `;
            }

            await enqueueFisSync(tx, fis, {pallet_id: palletId, project, model}, operator);
            await tx.commit();
        } catch (error: unknown) {
            if (error instanceof APIError) throw error;

            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("23505") || errorMessage.includes("duplicate key value")) {
                throw APIError.alreadyExists(t("pallet_exists", lang));
            }
            throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
        }

        return {status: true, pallet_id: palletId};
    },
);

export const UpdatePallet = api(
    {method: "PUT", path: "/pallets/:pallet_id", expose: true, auth: true},
    async (params: UpdatePalletParams): Promise<UpdatePalletResponse> => {
        const lang = params.acceptLanguage;
        const palletId = normalizePalletId(params.pallet_id);
        const operator = requirePalletManagementUser().fullName;
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", lang));

        try {
            await using tx = await db.begin();
            const existing = await tx.queryRow<PalletRecord>`
                SELECT * FROM pallets
                WHERE pallet_id = ${palletId} AND deleted_at IS NULL
                FOR UPDATE
            `;
            if (!existing) throw APIError.notFound(t("pallet_not_found", lang));
            const newFis = params.fis ?? existing.fis;
            const newNests = params.nests ?? existing.nests;
            const newMaxCycles = params.max_cycles ?? existing.max_cycles;
            const newStatus = params.status ?? existing.status;
            const newBlockReason = newStatus === "Blocked" ? (params.block_reason ?? existing.block_reason) : null;

            if (newFis !== 1 && newFis !== 2) throw APIError.invalidArgument(t("fis_unsupported", lang));
            if (!isSafePositiveInteger(newNests) || !isSafePositiveInteger(newMaxCycles)) {
                throw APIError.invalidArgument(t("integer_required", lang));
            }
            if (!newStatus || !isPalletStatus(newStatus)) {
                throw APIError.invalidArgument(t("status_invalid", lang, {status: String(newStatus)}));
            }
            if (newStatus === "Blocked" && !newBlockReason?.trim()) {
                throw APIError.invalidArgument(t("block_reason_required", lang));
            }

            const changes: Parameters<typeof encodeAuditChanges>[0] = [];
            if (existing.fis !== newFis) changes.push({key: "audit_change_fis", variables: {from: existing.fis ?? 0, to: newFis}});
            if (existing.nests !== newNests) changes.push({key: "audit_change_nests", variables: {from: existing.nests, to: newNests}});
            if (existing.max_cycles !== newMaxCycles) changes.push({key: "audit_change_max_cycles", variables: {from: existing.max_cycles, to: newMaxCycles}});

            const description = changes.length > 0
                ? encodeAuditChanges(changes)
                : encodeAuditDescription("audit_edited");

            await tx.exec`
                UPDATE pallets
                SET fis = ${newFis}, nests = ${newNests}, max_cycles = ${newMaxCycles}, status = ${newStatus},
                    block_reason = ${newBlockReason}, updated_at = NOW(), updated_by = ${operator},
                    last_operation_description = ${description}
                WHERE pallet_id = ${palletId}
            `;

            if (existing.fis !== newFis) {
                await enqueueFisMigration(
                    tx,
                    existing.fis,
                    newFis,
                    {pallet_id: existing.pallet_id, project: existing.project, model: existing.model},
                    operator,
                );
            }
            await tx.commit();
            return {status: true, pallet_id: palletId};
        } catch (error: unknown) {
            if (error instanceof APIError) throw error;
            throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
        }
    },
);

export const DeletePallet = api(
    {method: "DELETE", path: "/pallets/:pallet_id", expose: true, auth: true},
    async (params: DeletePalletParams): Promise<DeletePalletResponse> => {
        const lang = params.acceptLanguage;
        const operator = requirePalletManagementUser().fullName;
        const palletId = normalizePalletId(params.pallet_id);
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", lang));

        try {
            await using tx = await db.begin();
            const pallet = await tx.queryRow<PalletRecord>`
                SELECT * FROM pallets
                WHERE pallet_id = ${palletId} AND deleted_at IS NULL
                FOR UPDATE
            `;
            if (!pallet) throw APIError.notFound(t("pallet_not_found", lang));
            await tx.exec`
                UPDATE pallets
                SET deleted_at = NOW(), deleted_by = ${operator}, updated_at = NOW(), updated_by = ${operator},
                    last_operation_description = ${encodeAuditDescription("audit_deleted")}
                WHERE pallet_id = ${palletId} AND deleted_at IS NULL
            `;
            await enqueueFisDelete(tx, pallet.fis, palletId);
            await tx.commit();
        } catch (error: unknown) {
            if (error instanceof APIError) throw error;
            throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
        }

        return {status: true, pallet_id: palletId, message: t("pallet_deleted", lang)};
    },
);
