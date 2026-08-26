import {api, APIError, Header} from "encore.dev/api";
import {db} from "./db";
import {Project} from "../shared/types";
import {t} from "./i18n";
import {requirePalletManagementUser} from "../auth/authorization";

interface LocalizedRequest {
    acceptLanguage?: Header<"Accept-Language">;
}

export interface GetAllProjectsResponse {
    projects: Project[];
}

export interface AddProjectParams extends LocalizedRequest {
    name: string;
}

export const GetAllProjects = api(
    {method: "GET", path: "/projects", expose: true},
    async (): Promise<GetAllProjectsResponse> => {
        return {projects: await db.queryAll<Project>`SELECT * FROM projects ORDER BY name`};
    },
);

export const AddProject = api(
    {method: "POST", path: "/projects", expose: true, auth: true},
    async (params: AddProjectParams): Promise<void> => {
        requirePalletManagementUser();
        const projectName = params.name?.trim();
        if (!projectName) throw APIError.invalidArgument(t("project_name_empty", params.acceptLanguage));

        try {
            await db.exec`INSERT INTO projects (name) VALUES (${projectName})`;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("23505") || errorMessage.includes("duplicate key value")) {
                throw APIError.alreadyExists(t("project_exists", params.acceptLanguage));
            }
            throw APIError.internal(
                t("database_error", params.acceptLanguage),
                error instanceof Error ? error : undefined,
            );
        }
    },
);
