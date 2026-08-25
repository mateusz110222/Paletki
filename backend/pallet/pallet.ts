import {api, APIError, Header} from "encore.dev/api";
import {db} from "./db";
import {AuditLog, Pallet, PALLET_STATUSES, PalletStatus} from "../shared/types";
import {t} from "./i18n";
import {config} from "../config";
import {
    encodeAuditChanges,
    encodeAuditDescription,
    localizeAuditLog,
} from "./audit-description";
import {
    compensateFisMigration,
    FisClient,
    migrateFisUnit,
} from "./fis-client";
import {requireITDepartmentUser} from "../auth/authorization";

const {
    router1Url: FIS1_RouterPath,
    router2Url: FIS2_RouterPath,
    requestTimeoutMs: FISRequestTimeoutMs,
} = config.fis;
const fisClient = new FisClient(FISRequestTimeoutMs);

interface LocalizedRequest {
    acceptLanguage?: Header<"Accept-Language">;
}

export interface GetAllPalletsResponse {
    pallets: Pallet[];
}

interface GetPalletParams extends LocalizedRequest {
    pallet_id: string;
}

interface AddPalletParams extends LocalizedRequest {
    pallet_id: string;
    project: string;
    model: string;
    max_cycles: number;
    nests: number;
    status: PalletStatus | string;
    block_reason?: string | null;
    fis?: number | null;
}

export interface AddPalletResponse {
    status: boolean;
    pallet_id: string;
}

interface UpdatePalletParams extends LocalizedRequest {
    pallet_id: string;
    fis?: number | null;
    nests?: number | null;
    max_cycles?: number | null;
    status?: PalletStatus | string | null;
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
}

function isPalletStatus(status: string): status is PalletStatus {
    return PALLET_STATUSES.includes(status as PalletStatus);
}

function fisRouter(fis: number): string {
    if (fis === 1) return FIS1_RouterPath;
    if (fis === 2) return FIS2_RouterPath;
    throw APIError.failedPrecondition(t("fis_unsupported"));
}

function normalizePalletId(value: string): string {
    return (value ?? "").trim().toUpperCase();
}

export const GetAllPallets = api(
    {method: "GET", path: "/pallets", expose: true},
    async (): Promise<GetAllPalletsResponse> => {
        return {pallets: await db.queryAll<Pallet>`SELECT * FROM pallets`};
    },
);

export const GetPallet = api(
    {method: "GET", path: "/pallets/:pallet_id", expose: true},
    async (params: GetPalletParams): Promise<Pallet> => {
        const palletId = normalizePalletId(params.pallet_id);
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", params.acceptLanguage));

        const pallet = await db.queryRow<Pallet>`SELECT * FROM pallets WHERE pallet_id = ${palletId}`;
        if (!pallet) throw APIError.notFound(t("pallet_not_found", params.acceptLanguage));

        const history = await db.queryAll<AuditLog>`
            SELECT * FROM pallet_audit_logs WHERE pallet_id = ${palletId} ORDER BY timestamp DESC
        `;
        pallet.history = history.map((log) => localizeAuditLog(log, params.acceptLanguage));
        return pallet;
    },
);

export const GetAllPalletHistory = api(
    {method: "GET", path: "/pallets/audit-history", expose: true, auth: true},
    async (params: LocalizedRequest): Promise<AuditHistoryResponse> => {
        requireITDepartmentUser();
        const history = await db.queryAll<AuditLog>`
            SELECT * FROM pallet_audit_logs ORDER BY timestamp DESC
        `;
        return {history: history.map((log) => localizeAuditLog(log, params.acceptLanguage))};
    },
);

export const AddPallet = api(
    {method: "POST", path: "/pallets", expose: true, auth: true},
    async (params: AddPalletParams): Promise<AddPalletResponse> => {
        const lang = params.acceptLanguage;
        const palletId = normalizePalletId(params.pallet_id);
        const project = params.project?.trim();
        const model = params.model?.trim();
        const fis = params.fis ?? 0;
        const status = params.status ?? "Active";
        const operator = requireITDepartmentUser().fullName;

        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", lang));
        if (!project) throw APIError.invalidArgument(t("project_required", lang));
        if (!model) throw APIError.invalidArgument(t("model_required", lang));
        if (fis <= 0) throw APIError.invalidArgument(t("fis_invalid", lang));
        if (fis !== 1 && fis !== 2) throw APIError.invalidArgument(t("fis_unsupported", lang));
        if (!isPalletStatus(status)) throw APIError.invalidArgument(t("status_invalid", lang, {status}));
        if (status === "Blocked" && !params.block_reason?.trim()) {
            throw APIError.invalidArgument(t("block_reason_required", lang));
        }
        if (params.max_cycles <= 0) throw APIError.invalidArgument(t("max_cycles_invalid", lang));
        if (params.nests <= 0) throw APIError.invalidArgument(t("nests_invalid", lang));

        const projectExists = await db.queryRow<{exists: boolean}>`
            SELECT EXISTS(SELECT 1 FROM projects WHERE LOWER(name) = LOWER(${project})) AS exists
        `;
        if (!projectExists?.exists) throw APIError.invalidArgument(t("project_required", lang));

        const router = fisRouter(fis);
        let fisSynchronized = false;

        try {
            await using tx = await db.begin();
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

            await fisClient.synchronizeUnit(router, {pallet_id: palletId, project, model}, operator, lang);
            fisSynchronized = true;
            await tx.commit();
        } catch (error: unknown) {
            if (fisSynchronized) {
                try {
                    await fisClient.deleteUnitIfPresent(router, palletId, lang);
                } catch (compensationError) {
                    console.error("FIS compensation after failed pallet insert did not succeed", compensationError);
                }
            }

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
        const operator = requireITDepartmentUser().fullName;
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", lang));

        let existingForCompensation: Pallet | null = null;
        let migratedFis: number | null = null;

        try {
            await using tx = await db.begin();
            const existing = await tx.queryRow<Pallet>`
                SELECT * FROM pallets WHERE pallet_id = ${palletId} FOR UPDATE
            `;
            if (!existing) throw APIError.notFound(t("pallet_not_found", lang));
            existingForCompensation = existing;

            const newFis = params.fis ?? existing.fis ?? 0;
            const newNests = params.nests ?? existing.nests;
            const newMaxCycles = params.max_cycles ?? existing.max_cycles;
            const newStatus = params.status ?? existing.status;
            const newBlockReason = newStatus === "Blocked" ? (params.block_reason ?? existing.block_reason) : null;

            if (newFis === null || newFis <= 0) throw APIError.invalidArgument(t("fis_invalid", lang));
            if (newFis !== 1 && newFis !== 2) throw APIError.invalidArgument(t("fis_unsupported", lang));
            if (newNests <= 0) throw APIError.invalidArgument(t("nests_invalid", lang));
            if (newMaxCycles <= 0) throw APIError.invalidArgument(t("max_cycles_invalid", lang));
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

            if (await migrateFisUnit(fisClient, fisRouter, existing, newFis, operator, lang)) {
                migratedFis = newFis;
            }
            await tx.commit();
            return {status: true, pallet_id: palletId};
        } catch (error: unknown) {
            if (existingForCompensation && migratedFis !== null) {
                try {
                    await compensateFisMigration(
                        fisClient,
                        fisRouter,
                        existingForCompensation,
                        migratedFis,
                        operator,
                        lang,
                    );
                } catch (compensationError) {
                    console.error("FIS compensation after failed pallet update did not succeed", compensationError);
                }
            }
            if (error instanceof APIError) throw error;
            throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
        }
    },
);

export const DeletePallet = api(
    {method: "DELETE", path: "/pallets/:pallet_id", expose: true, auth: true},
    async (params: DeletePalletParams): Promise<DeletePalletResponse> => {
        const lang = params.acceptLanguage;
        requireITDepartmentUser();
        const palletId = normalizePalletId(params.pallet_id);
        if (!palletId) throw APIError.invalidArgument(t("pallet_id_empty", lang));

        let existingForCompensation: Pallet | null = null;
        let fisUnitDeleted = false;

        try {
            await using tx = await db.begin();
            const pallet = await tx.queryRow<Pallet>`
                SELECT * FROM pallets WHERE pallet_id = ${palletId} FOR UPDATE
            `;
            if (!pallet) throw APIError.notFound(t("pallet_not_found", lang));
            existingForCompensation = pallet;

            const assignedFis = pallet.fis ?? 0;
            const router = fisRouter(assignedFis);
            fisUnitDeleted = await fisClient.deleteUnitIfPresent(router, palletId, lang);

            await tx.exec`DELETE FROM pallets WHERE pallet_id = ${palletId}`;
            await tx.commit();
        } catch (error: unknown) {
            if (existingForCompensation && fisUnitDeleted) {
                try {
                    await fisClient.synchronizeUnit(
                        fisRouter(existingForCompensation.fis ?? 0),
                        {
                            pallet_id: existingForCompensation.pallet_id,
                            project: existingForCompensation.project,
                            model: existingForCompensation.model,
                        },
                        "SYSTEM_DB_ROLLBACK",
                        lang,
                    );
                } catch (compensationError) {
                    console.error("FIS compensation after failed pallet deletion did not succeed", compensationError);
                }
            }
            if (error instanceof APIError) throw error;
            throw APIError.internal(t("database_error", lang), error instanceof Error ? error : undefined);
        }

        return {status: true, pallet_id: palletId, message: t("pallet_deleted", lang)};
    },
);
