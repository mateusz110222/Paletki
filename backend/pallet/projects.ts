import { api, APIError, Header } from "encore.dev/api";
import { db } from "./db";
import { Project } from "../shared/types";
import { t } from "./i18n";

export interface GetAllProjectsResponse {
    projects: Project[];
}

export interface AddProjectParams {
    name: string;
    acceptLanguage?: Header<"Accept-Language">;
}

export const GetAllProjects = api(
    { method: "GET", path: "/projects", expose: true },
    async (): Promise<GetAllProjectsResponse> => {
        const projects = await db.queryAll<Project>`SELECT * FROM projects`;

        if (projects.length === 0) {
            return { projects: [] };
        }

        return { projects };
    }
);

export const AddProject = api(
    { method: "POST", path: "/projects", expose: true },
    async (params: AddProjectParams): Promise<void> => {
        const lang = params.acceptLanguage;

        if (!params.name?.trim()) {
            throw APIError.invalidArgument(t("project_name_empty", lang));
        }

        const projectName = params.name.trim();

        try {
                await using tx = await db.begin();

            await tx.exec`
                INSERT INTO projects (name)
                VALUES (${projectName})
            `;

            await tx.commit();
        } catch (err: any) {
            const isUniqueViolation =
                String(err?.message || err).includes('23505') ||
                String(err?.message || err).includes('duplicate key value');

            if (isUniqueViolation) {
                throw APIError.alreadyExists(t("project_exists", lang));
            }

            const errorMessage = err instanceof Error ? err.message : String(err);
            throw APIError.internal(errorMessage);
        }
    }
);