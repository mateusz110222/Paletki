import {APIError} from "encore.dev/api";
import {getAuthData} from "~encore/auth";
import type {AuthData} from "./auth";
import {t} from "../pallet/i18n";

export function requireAuthenticatedUser(): AuthData {
    const auth = getAuthData();
    if (!auth) throw APIError.unauthenticated(t("auth_session_invalid"));
    return auth;
}

export function requireITDepartmentUser(): AuthData {
    const auth = requireAuthenticatedUser();
    if (!auth.hasITDepartmentAccess) {
        throw APIError.permissionDenied(t("auth_staff_required"));
    }
    return auth;
}
