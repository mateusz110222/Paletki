import {api} from "encore.dev/api";
import {db} from "./db";

export const Health = api({method: "GET", path: "/healthz", expose: true},
    async (): Promise<{ok: true}> => {
        await db.queryRow`SELECT 1`;
        return {ok: true};
    },
);
