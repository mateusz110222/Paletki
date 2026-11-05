import sql from "mssql";
import {config} from "../config";
import {apacsDbPassword} from "./secrets";

interface CardAssignment {
    externalId: number;
    firstName: string | null;
    lastName: string | null;
    active: number | null;
    validFrom: Date | null;
    validTo: Date | null;
    overrideActive: number | null;
}

let poolPromise: Promise<sql.ConnectionPool> | undefined;

function logApacsFailure(stage: "connect" | "query" | "pool", error: unknown): void {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" &&
        /^(ELOGIN|ETIMEOUT|ESOCKET|ECONNCLOSED|ENOTOPEN|EINSTLOOKUP|EREQUEST|ECANCEL|ENOCONN)$/.test(error.code)
        ? error.code : "UNKNOWN";
    console.error("APACS failure", {stage, code});
}

function getPool(): Promise<sql.ConnectionPool> {
    if (poolPromise) return poolPromise;
    const password = apacsDbPassword();
    if (!password) throw new Error("APACS is not configured");
    const {server, port, database, user, encrypt, trustServerCertificate, connectionTimeout, requestTimeout} = config.apacs;
    poolPromise = new sql.ConnectionPool({
        server, port, database, user, password, connectionTimeout, requestTimeout,
        options: {encrypt, trustServerCertificate},
        pool: {max: 5, min: 0, idleTimeoutMillis: 30000},
    }).on("error", (error: unknown) => logApacsFailure("pool", error)).connect().catch((error: unknown) => {
        poolPromise = undefined;
        logApacsFailure("connect", error);
        throw new Error("APACS connection unavailable", {cause: error});
    });
    return poolPromise;
}

export async function findActiveCardOperator(identifier: string) {
    const numeric = BigInt(identifier);
    const pool = await getPool();
    const result = await pool.request()
        .input("identifier", sql.VarChar(30), identifier)
        .input("cardNumber", sql.Int, numeric <= 2147483647n ? Number(numeric) : null)
        .query<CardAssignment>(`
            SELECT ch.FCARDHOLDERID AS externalId, ch.FFIRST AS firstName, ch.FLAST AS lastName,
                ci.FACTIVE AS active, ci.FDATEFROM AS validFrom, ci.FDATETO AS validTo,
                ci.FOVERRIDEACTIVE AS overrideActive
            FROM dbo.TCARDISSUE AS ci
            INNER JOIN dbo.TCARDHOLDERS AS ch ON ch.FID = ci.FCHID
            WHERE LTRIM(RTRIM(ci.FLONGCARDNUM)) = @identifier
                OR LTRIM(RTRIM(ci.FUUID)) = @identifier
                OR ci.FCARDNUM = @cardNumber
        `).catch((error: unknown) => {
            logApacsFailure("query", error);
            throw new Error("APACS query unavailable", {cause: error});
        });
    // Reject ambiguous ownership even if only one assignment is currently active.
    if (new Set(result.recordset.map(row => row.externalId)).size !== 1) return null;
    const now = new Date();
    const operator = result.recordset.find(row => row.active === 1 &&
        (row.overrideActive === 1 || ((!row.validFrom || row.validFrom <= now) &&
            (!row.validTo || row.validTo >= now))));
    if (!operator || !Number.isSafeInteger(operator.externalId)) return null;
    const fullName = `${operator.firstName?.trim() ?? ""} ${operator.lastName?.trim() ?? ""}`.trim();
    if (!fullName || fullName.length > 256) return null;
    return {externalId: String(operator.externalId), fullName};
}
