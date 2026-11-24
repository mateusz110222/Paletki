import {secret} from "encore.dev/config";

const encoreApacsDbPassword = secret("APACSDBPassword");

export function apacsDbPassword(): string {
    return encoreApacsDbPassword() || process.env.APACS_DB_PASSWORD || "";
}
