interface ImportMetaWithEnv extends ImportMeta {
    readonly env?: {
        readonly DEV?: boolean;
        readonly VITE_DEV_API_BASE_URL?: string;
        readonly VITE_PROD_API_BASE_URL?: string;
    };
}

const env = (import.meta as ImportMetaWithEnv).env;

export const API_BASE_URL = env?.DEV
    ? env.VITE_DEV_API_BASE_URL ?? ""
    : env?.VITE_PROD_API_BASE_URL ?? "";
