import {SQLDatabase} from "encore.dev/storage/sqldb";

// Paletki is deployed as one modular monolith. The pallet module owns schema
// migrations, while auth and FIS receive this explicit reference to the shared
// persistence boundary instead of discovering the database independently.
export const palletsDatabase = SQLDatabase.named("pallets");
