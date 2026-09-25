import {createPool, type Pool} from "mysql2/promise";
import type {RowDataPacket} from "mysql2";
import {config} from "../config";
import {fisDbPassword} from "./secrets";

let pool: Pool | undefined;

interface UserRow extends RowDataPacket { pk: number; }
interface TableRow extends RowDataPacket { tableName: string; }
interface GroupRow extends RowDataPacket { group_name: string; }

function fisPool(): Pool {
    return pool ??= createPool({
        host: config.fisGroups.host,
        port: config.fisGroups.port,
        user: config.fisGroups.user,
        password: fisDbPassword(),
        waitForConnections: true,
        connectionLimit: 5,
        connectTimeout: 5_000,
    });
}

export function fisNetId(username: string): string {
    const withoutDomain = username.trim().split("\\").pop() ?? "";
    return withoutDomain.split("@")[0].trim();
}

export async function getFisGroups(username: string): Promise<string[]> {
    const netId = fisNetId(username);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(netId)) {
        throw new Error("Invalid FIS user identifier");
    }

    const db = fisPool();
    const [users] = await db.query<UserRow[]>(
        "SELECT pk FROM `users`.`tbl_users` WHERE TRIM(name) = ? OR userId = ? LIMIT 1",
        [netId, netId],
    );
    if (!users.length) return [];

    const [tables] = await db.query<TableRow[]>(
        "SELECT tableName FROM `groups`.`groupList`",
    );
    const names = [...new Set(tables.map(row => row.tableName))]
        .filter(name => /^[A-Za-z0-9_]+$/.test(name));
    if (!names.length) return [];

    const clauses = names.map(name => `SELECT ? AS group_name FROM \`groups\`.\`${name}\` WHERE user_fk = ?`);
    const values = names.flatMap(name => [name, users[0].pk]);
    const [groups] = await db.query<GroupRow[]>(
        clauses.join(" UNION ALL "), values,
    );
    return [...new Set(groups.map(row => row.group_name))];
}
