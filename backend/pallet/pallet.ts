import {api, APIError, Header} from "encore.dev/api";
import {db} from "./db";
import {AuditLog, Pallet, PalletStatus} from "../shared/types";
import {t} from "./i18n";
import {FIS1_RouterPath, FIS2_RouterPath} from "../shared/API_BASE_URL";

export interface GetAllPalletsResponse {
    pallets: Pallet[];
}

interface GetPalletParams {
    pallet_id: string;
    acceptLanguage?: Header<"Accept-Language">;
}

interface AddPalletParams {
    pallet_id: string;
    project: string;
    model: string;
    max_cycles: number;
    nests: number;
    status: PalletStatus | string;
    block_reason?: string | null;
    fis?: number | null;
    created_by: string;
    acceptLanguage?: Header<"Accept-Language">;
}

export interface AddPalletResponse {
    status: boolean;
    pallet_id: string;
}

interface GetPalletHistoryParams {
    pallet_id: string;
    acceptLanguage?: Header<"Accept-Language">;
}

export interface GetPalletHistoryResponse {
    history: AuditLog[];
}

export const GetAllPallets = api(
    {method: "GET", path: "/pallets", expose: true},
    async (): Promise<GetAllPalletsResponse> => {
        const pallets = await db.queryAll<Pallet>`SELECT *
                                                  FROM pallets`;

        if (pallets.length === 0) {
            return {pallets: []};
        }

        return {pallets};
    }
);

export const GetPallet = api(
    {method: "GET", path: "/pallets/:pallet_id", expose: true},
    async (params: GetPalletParams): Promise<Pallet> => {
        const lang = params.acceptLanguage;

        const pallet = await db.queryRow<Pallet>`
            SELECT *
            FROM pallets
            WHERE pallet_id = ${params.pallet_id}
        `;
        if (!pallet) throw APIError.notFound(t("pallet_not_found", lang));

        pallet.history = await db.queryAll<AuditLog>`
            SELECT *
            FROM pallet_audit_logs
            WHERE pallet_id = ${pallet.pallet_id}
            ORDER BY timestamp DESC
        `;

        return pallet;
    }
);

export const AddPallet = api(
    {method: "POST", path: "/pallets", expose: true},
    async (params: AddPalletParams): Promise<AddPalletResponse> => {
        const lang = params.acceptLanguage;

        if (!params.pallet_id?.trim()) {
            throw APIError.invalidArgument(t("pallet_id_empty", lang));
        }

        const fisValue = params.fis ?? 0;
        if (fisValue <= 0) {
            throw APIError.invalidArgument(t("fis_invalid", lang));
        }

        if (!params.created_by?.trim()) {
            throw APIError.invalidArgument(t("operator_required", lang));
        }

        const status = params.status ?? "Active";
        if (status === "Blocked" && !params.block_reason?.trim()) {
            throw APIError.invalidArgument(t("block_reason_required", lang));
        }

        if (params.max_cycles !== undefined && params.max_cycles <= 0) {
            throw APIError.invalidArgument(t("max_cycles_invalid", lang));
        }

        if (params.nests !== undefined && params.nests <= 0) {
            throw APIError.invalidArgument(t("nests_invalid", lang));
        }

        try {
            const unit = params.pallet_id;

            const fetch_path = params.fis === 1 ? FIS1_RouterPath : FIS2_RouterPath;

            const findResponse = await fetch(`${fetch_path}?job=Unit_Find`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    Unit: unit,
                }),
            });

            if (!findResponse.ok) {
                throw new Error(`Unit_Find HTTP error: ${findResponse.status} ${findResponse.statusText}`);
            }

            const findResult = await findResponse.json() as { status: boolean; message?: string };

            if (findResult.status === true) {
                const deleteResponse = await fetch(`${fetch_path}?job=Unit_DeleteUnit`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        Unit: unit,
                    }),
                });

                if (!deleteResponse.ok) {
                    throw new Error(`Unit_DeleteUnit HTTP error: ${deleteResponse.status} ${deleteResponse.statusText}`);
                }

                const deleteResult = await deleteResponse.json() as { status: boolean; message?: string };

                if (deleteResult.status !== true) {
                    throw new Error(`Unit_DeleteUnit failed: ${deleteResult.message ?? "Unknown error"}`);
                }
            }

            const createResponse = await fetch(`${fetch_path}?job=Unit_DataEntry`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    Unit: unit,
                    Process: "CREATEUNIT",
                    Station: "WEB",
                    DcString: `COMMENT|CREATED PALLET|PROJECT|${params.project}|MODEL|${params.model}|OPERATOR|${params.created_by}`,
                    UserKey3: "PALLET",
                }),
            });

            if (!createResponse.ok) {
                throw new Error(`Unit_DataEntry HTTP error: ${createResponse.status} ${createResponse.statusText}`);
            }

            const createResult = await createResponse.json() as { status: boolean; message?: string };

            if (createResult.status !== true) {
                throw new Error(`Unit_DataEntry failed: ${createResult.message ?? "Unknown error"}`);
            }

                await using tx = await db.begin();

            await tx.exec`
                INSERT INTO pallets (pallet_id, project, model, max_cycles, nests, status,
                                     block_reason, fis, created_by, updated_by, last_operation_description)
                VALUES (${params.pallet_id.trim()},
                        ${params.project?.trim() ?? null},
                        ${params.model?.trim() ?? null},
                        ${params.max_cycles ?? 200},
                        ${params.nests ?? 1},
                        ${status},
                        ${params.block_reason?.trim() ?? null},
                        ${fisValue},
                        ${params.created_by.trim()},
                        ${params.created_by.trim()},
                        ${t("added_new_pallet", lang)})
            `;

            await tx.commit();
        } catch (err: unknown) {
            const isUniqueViolation =
                String(err?.message || err).includes('23505') ||
                String(err?.message || err).includes('duplicate key value');

            if (isUniqueViolation) {
                throw APIError.alreadyExists(t("pallet_exists", lang));
            }

            const errorMessage = err instanceof Error ? err.message : String(err);
            throw APIError.internal(errorMessage);
        }

        return {
            status: true,
            pallet_id: params.pallet_id,
        };
    }
);

interface UpdatePalletParams {
    pallet_id: string;
    fis?: number | null;
    nests?: number | null;
    max_cycles?: number | null;
    status?: PalletStatus | string | null;
    block_reason?: string | null;
    operator_id: string;
    acceptLanguage?: Header<"Accept-Language">;
}

export interface UpdatePalletResponse {
    status: boolean;
    pallet_id: string;
}

export const UpdatePallet = api(
    {method: "PUT", path: "/pallets/:pallet_id", expose: true},
    async (params: UpdatePalletParams): Promise<UpdatePalletResponse> => {
        const lang = params.acceptLanguage;
        const palletId = params.pallet_id?.trim();

        if (!palletId) {
            throw APIError.invalidArgument(t("pallet_id_empty", lang));
        }
        if (!params.operator_id?.trim()) {
            throw APIError.invalidArgument(t("operator_required", lang));
        }

            await using tx = await db.begin();

        const existing = await tx.queryRow<Pallet>`
            SELECT *
            FROM pallets
            WHERE pallet_id = ${palletId}
        `;
        if (!existing) {
            throw APIError.notFound(t("pallet_not_found", lang));
        }

        const newFis = params.fis ?? existing.fis;
        const newNests = params.nests ?? existing.nests;
        const newMaxCycles = params.max_cycles ?? existing.max_cycles;
        const newStatus = (params.status ?? existing.status) as PalletStatus;
        const newBlockReason = newStatus === 'Blocked' ? (params.block_reason ?? existing.block_reason) : null;

        if (newFis !== undefined && newFis !== null && newFis <= 0) {
            throw APIError.invalidArgument(t("fis_invalid", lang));
        }
        if (newNests !== undefined && newNests !== null && newNests <= 0) {
            throw APIError.invalidArgument(t("nests_invalid", lang));
        }
        if (newMaxCycles !== undefined && newMaxCycles !== null && newMaxCycles <= 0) {
            throw APIError.invalidArgument(t("max_cycles_invalid", lang));
        }
        if (newStatus === "Blocked" && !newBlockReason?.trim()) {
            throw APIError.invalidArgument(t("block_reason_required", lang));
        }

        const changes: string[] = [];

        if (existing.fis !== newFis) {
            changes.push(`FIS ${existing.fis} → ${newFis}`);
        }
        if (existing.nests !== newNests) {
            changes.push(`gniazda ${existing.nests} → ${newNests}`);
        }
        if (existing.max_cycles !== newMaxCycles) {
            changes.push(`limit cykli ${existing.max_cycles} → ${newMaxCycles}`);
        }

        let operationDescription: string | null = null;

        if (changes.length > 0) {
            operationDescription = "Zmieniono: " + changes.join(", ");
        }

        await tx.exec`
            UPDATE pallets
            SET fis                        = ${newFis},
                nests                      = ${newNests},
                max_cycles                 = ${newMaxCycles},
                status                     = ${newStatus},
                block_reason               = ${newBlockReason},
                updated_at                 = NOW(),
                updated_by                 = ${params.operator_id.trim()},
                last_operation_description = ${operationDescription}
            WHERE pallet_id = ${palletId}
        `;

        await tx.commit();

        return {
            status: true,
            pallet_id: palletId
        };
    }
);

export const GetPalletHistory = api(
    {method: "GET", path: "/pallets/:pallet_id/history", expose: true},
    async (params: GetPalletHistoryParams): Promise<GetPalletHistoryResponse> => {
        const lang = params.acceptLanguage;

        if (!params.pallet_id?.trim()) {
            throw APIError.invalidArgument(t("pallet_id_empty", lang));
        }

        const history = await db.queryAll<AuditLog>`
            SELECT *
            FROM pallet_audit_logs
            WHERE pallet_id = ${params.pallet_id.trim()}
            ORDER BY timestamp DESC
        `;

        return {history: history || []};
    }
);