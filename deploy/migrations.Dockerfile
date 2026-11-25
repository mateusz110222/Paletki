FROM migrate/migrate:v4.18.3
COPY backend/pallet/migrations/*.up.sql /migrations/
COPY deploy/run-migrations.sh /usr/local/bin/run-migrations
ENTRYPOINT ["/bin/sh", "/usr/local/bin/run-migrations"]
