import {api, APIError, Header} from "encore.dev/api";
import {db} from "./db";
import type {PalletModel} from "../shared/types";
import {t} from "../shared/i18n";
import {requirePalletManagementUser} from "../shared/authorization";
import {isFisSafeText, type ShortText} from "../shared/validation";

interface LocalizedRequest {
    acceptLanguage?: Header<"Accept-Language">;
}

export interface GetAllModelsResponse {
    models: PalletModel[];
}

export interface AddModelParams extends LocalizedRequest {
    project: ShortText;
    name: ShortText;
}

export const GetAllModels = api(
    {method: "GET", path: "/models", expose: true},
    async (): Promise<GetAllModelsResponse> => ({
        models: await db.queryAll<PalletModel>`
            SELECT pallet_models.name, projects.name AS project
            FROM pallet_models
            JOIN projects ON projects.id = pallet_models.project_id
            ORDER BY projects.name, pallet_models.name
        `,
    }),
);

export const AddModel = api(
    {method: "POST", path: "/models", expose: true, auth: true},
    async (params: AddModelParams): Promise<void> => {
        requirePalletManagementUser();
        const projectName = params.project?.trim();
        const modelName = params.name?.trim();

        if (!projectName) throw APIError.invalidArgument(t("project_required", params.acceptLanguage));
        if (!modelName) throw APIError.invalidArgument(t("model_name_empty", params.acceptLanguage));
        if (!isFisSafeText(projectName) || !isFisSafeText(modelName)) {
            throw APIError.invalidArgument(t("fis_text_invalid", params.acceptLanguage));
        }

        const project = await db.queryRow<{id: number}>`
            SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER(TRIM(${projectName}))
        `;
        if (!project) throw APIError.invalidArgument(t("project_required", params.acceptLanguage));

        try {
            await db.exec`
                INSERT INTO pallet_models (project_id, name)
                VALUES (${project.id}, ${modelName})
            `;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("23505") || errorMessage.includes("duplicate key value")) {
                throw APIError.alreadyExists(t("model_exists", params.acceptLanguage));
            }
            throw APIError.internal(
                t("database_error", params.acceptLanguage),
                error instanceof Error ? error : undefined,
            );
        }
    },
);
