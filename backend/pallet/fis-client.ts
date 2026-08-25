import {APIError} from "encore.dev/api";
import {Pallet} from "../shared/types";
import {t} from "./i18n";

interface FisResponse {
    status: boolean;
    message?: string;
}

export interface FisUnitDetails {
    pallet_id: string;
    project: string;
    model: string;
}

export type FisRouterResolver = (fis: number) => string;

export class FisClient {
    constructor(
        private readonly requestTimeoutMs: number,
        private readonly fetchImplementation: typeof fetch = fetch,
    ) {}

    private async call(
        router: string,
        operation: string,
        body: Record<string, string>,
        lang?: string,
    ): Promise<FisResponse> {
        let response: Response;

        try {
            response = await this.fetchImplementation(`${router}?job=${operation}`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(this.requestTimeoutMs),
            });
        } catch (error) {
            throw APIError.unavailable(
                t("fis_connection_error", lang, {operation}),
                error instanceof Error ? error : undefined,
            );
        }

        if (!response.ok) {
            throw APIError.unavailable(t("fis_http_error", lang, {
                operation,
                status: response.status,
                statusText: response.statusText,
            }));
        }

        let result: unknown;
        try {
            result = await response.json();
        } catch (error) {
            throw APIError.internal(
                t("fis_invalid_response", lang, {operation}),
                error instanceof Error ? error : undefined,
            );
        }

        if (
            typeof result !== "object" ||
            result === null ||
            !("status" in result) ||
            typeof result.status !== "boolean" ||
            ("message" in result && result.message !== undefined && typeof result.message !== "string")
        ) {
            throw APIError.internal(t("fis_invalid_response", lang, {operation}));
        }

        return result as FisResponse;
    }

    private assertSuccess(result: FisResponse, operation: string, lang?: string): void {
        if (result.status) return;
        if (!result.message?.trim()) {
            throw APIError.internal(t("fis_invalid_response", lang, {operation}));
        }
        throw APIError.failedPrecondition(t("fis_operation_failed", lang, {
            operation,
            message: result.message.trim(),
        }));
    }

    async deleteUnit(router: string, palletId: string, lang?: string): Promise<void> {
        const result = await this.call(router, "Unit_Delete", {Unit: palletId}, lang);
        this.assertSuccess(result, "Unit_Delete", lang);
    }

    async deleteUnitIfPresent(router: string, palletId: string, lang?: string): Promise<boolean> {
        const findResult = await this.call(router, "Unit_Find", {Unit: palletId}, lang);
        if (!findResult.status) return false;

        await this.deleteUnit(router, palletId, lang);
        return true;
    }

    async synchronizeUnit(
        router: string,
        details: FisUnitDetails,
        operator: string,
        lang?: string,
    ): Promise<void> {
        await this.deleteUnitIfPresent(router, details.pallet_id, lang);

        try {
            const createResult = await this.call(router, "Unit_DataEntry", {
                Unit: details.pallet_id,
                Process: "CREATEUNIT",
                Station: "WEB",
                DcString: `COMMENT|CREATED PALLET|PROJECT|${details.project}|MODEL|${details.model}|OPERATOR|${operator}`,
                UserKey3: "PALLET",
            }, lang);
            this.assertSuccess(createResult, "Unit_DataEntry", lang);
        } catch (error) {
            try {
                await this.deleteUnitIfPresent(router, details.pallet_id, lang);
            } catch (cleanupError) {
                console.error("Could not clean FIS after a failed pallet creation", cleanupError);
            }
            throw error;
        }
    }
}

export async function migrateFisUnit(
    client: FisClient,
    routerForFis: FisRouterResolver,
    existing: Pallet,
    newFis: number,
    operator: string,
    lang?: string,
): Promise<boolean> {
    const oldFis = existing.fis ?? 0;
    if (oldFis === newFis) return false;

    const details: FisUnitDetails = {
        pallet_id: existing.pallet_id,
        project: existing.project,
        model: existing.model,
    };
    const newRouter = routerForFis(newFis);

    await client.synchronizeUnit(newRouter, details, operator, lang);

    try {
        if (oldFis > 0) {
            await client.deleteUnitIfPresent(routerForFis(oldFis), existing.pallet_id, lang);
        }
        return true;
    } catch (error) {
        try {
            await client.deleteUnitIfPresent(newRouter, existing.pallet_id, lang);
        } catch (cleanupError) {
            console.error("Could not clean the new FIS route after migration failure", cleanupError);
        }
        throw error;
    }
}

export async function compensateFisMigration(
    client: FisClient,
    routerForFis: FisRouterResolver,
    existing: Pallet,
    newFis: number,
    operator: string,
    lang?: string,
): Promise<void> {
    const oldFis = existing.fis ?? 0;
    if (oldFis > 0) {
        await client.synchronizeUnit(routerForFis(oldFis), {
            pallet_id: existing.pallet_id,
            project: existing.project,
            model: existing.model,
        }, operator, lang);
    }

    await client.deleteUnitIfPresent(routerForFis(newFis), existing.pallet_id, lang);
}
