import {api} from "encore.dev/api";
import * as fs from "fs";
import * as path from "path";
import {db} from "./db.ts";

interface PalletInput {
    pallet_id: string;
}

const MODELS = ["Model-Alpha", "Model-Beta", "EV-Module-V2", "SMT-Board-X"];
const STATUSES = ["Active", "Active", "Active", "Washing_Required", "Damaged"];

export const seedDatabase = api(
    {expose: true, method: "POST", path: "/admin/seed"},
    async (): Promise<{ message: string; count: number }> => {

        const filePath = path.join(process.cwd(), "pallet", "pallets.json");
        const rawData = fs.readFileSync(filePath, "utf-8");
        const pallets: PalletInput[] = JSON.parse(rawData);

        let insertedCount = 0;

        for (const item of pallets) {
            const palletId = item.pallet_id?.trim();
            if (!palletId) continue;

            const project = palletId.substring(0, 3).toUpperCase();
            const model = MODELS[Math.floor(Math.random() * MODELS.length)];
            const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
            const maxCycles = 200;
            const currentCycles = Math.floor(Math.random() * maxCycles);
            const totalCycles = currentCycles + Math.floor(Math.random() * 300);
            const nests = [1, 2, 4][Math.floor(Math.random() * 3)];

            await db.exec`
                INSERT INTO pallets (pallet_id, project, model, max_cycles, current_cycles, total_cycles, nests, status,
                                     created_by)
                VALUES (${palletId}, ${project}, ${model}, ${maxCycles}, ${currentCycles}, ${totalCycles}, ${nests},
                        ${status}, 'seeder')
                ON CONFLICT
                    (pallet_id)
                DO NOTHING;
            `;
            insertedCount++;
        }

        return {message: "Database seeded successfully", count: insertedCount};
    }
);