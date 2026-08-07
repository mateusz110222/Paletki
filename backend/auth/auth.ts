import { api, APIError, Header } from "encore.dev/api";
import { Client } from "ldapts";
import { LoginResponse } from "../shared/types";
import { t } from "../pallet/i18n";

interface LoginRequest {
    login: string;
    password: string;
    acceptLanguage?: Header<"Accept-Language">;
}

export const Login = api(
    { method: "POST", path: "/auth/login", expose: true },
    async (params: LoginRequest): Promise<LoginResponse> => {
        const lang = params.acceptLanguage;
        const login = params.login?.trim();
        const password = params.password;

        if (!login || !password) {
            throw APIError.invalidArgument(t("login_password_required", lang));
        }

        const ldapUrl = "ldaps://global.borgwarner.net:3269";

        const client = new Client({
            url: ldapUrl,
            tlsOptions: { rejectUnauthorized: false },
            timeout: 5000,
        });

        try {
            await client.bind(login, password);

            const searchBase = "DC=global,DC=borgwarner,DC=net";

            const { searchEntries } = await client.search(searchBase, {
                scope: "sub",
                filter: `(|(userPrincipalName=${login})(sAMAccountName=${login})(mail=${login}))`,
                attributes: [
                    "displayName",
                    "mail",
                    "title",
                    "department",
                    "cn",
                    "givenName",
                    "sn",
                ],
            });

            await client.unbind();
            const userData = searchEntries[0] || {};

            const fullName = userData.displayName?.toString() || userData.cn?.toString() || login;
            const department = userData.department?.toString() || "";
            const title = userData.title?.toString() || "";

            return {
                status: true,
                message: t("auth_success", lang),
                data: {
                    FullName: fullName,
                    department: department,
                    title: title,
                    username: login,
                },
            };
        } catch (error) {
            try {
                await client.unbind();
            } catch {
            }

            const errorMsg = error instanceof Error ? error.message : String(error);

            if (errorMsg.includes("InvalidCredentials") || errorMsg.includes("data 52e")) {
                throw APIError.unauthenticated(t("auth_invalid_credentials", lang));
            }

            if (errorMsg.includes("ETIMEDOUT")) {
                throw APIError.unavailable(t("auth_timeout", lang));
            }

            throw APIError.internal(t("auth_error", lang), error instanceof Error ? error : new Error(errorMsg));
        }
    }
);