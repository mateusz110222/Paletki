import {api, APIError} from "encore.dev/api";
import {db} from "./db";
import {Pallet} from "../shared/types";

export interface GetAllPalletsResponse {
    pallets: Pallet[];
}

interface GetPalletParams {
    pallet_id: string;
}

export const GetAllPallets = api(
    {method: "GET", path: "/pallets", expose: true},
    async (): Promise<GetAllPalletsResponse> => {
        const pallets: Pallet[] = [];

        for await (const pallet of await db.queryAll<Pallet>`SELECT *
                                                             FROM pallets`) {
            pallets.push(pallet);
        }

        return {pallets};
    }
);

export const GetPallet = api(
    {method: "POST", path: "/pallet", expose: true},
    async (params: GetPalletParams): Promise<Pallet> => {
        const row = await db.queryRow<Pallet>`SELECT *
                                              FROM pallets
                                              WHERE pallet_id = ${params.pallet_id}`;
        if (!row) throw APIError.notFound("url not found");
        return row
    }
);

export const AddPallet = api(
    {method: "POST", path: "/pallet", expose: true},
    async (params: Pallet): Promise<Pallet> => {
        const row = await db.exec`INSERT INTO public.pallets (id, pallet_id, max_cycles, current_cycles,
                                                              current_unit_cycle, total_cycles, nests, status,
                                                              block_reason, fis, created_by)
                                  values (${params.id}, ${params.pallet_id}, ${params.max_cycles},
                                          ${params.current_cycles}, ${params.current_unit_cycle},
                                          ${params.total_cycles}, ${params.nests}, ${params.status},
                                          ${params.block_reason}, ${params.fis}, ${params.created_by});`;
    }
);