FROM migrate/migrate:v4.18.3
COPY backend/pallet/migrations/*.up.sql /migrations/
