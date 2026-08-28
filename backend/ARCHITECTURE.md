# Backend architecture

The backend is a **modular monolith**. It is built and deployed as one Encore
application and one Docker container. The `auth`, `pallet`, and `fis` folders
are API/domain modules, not independently deployable microservices.

## Dependency rules

- Domain modules may depend on `shared`; they must not import another domain
  module's implementation.
- Authentication data, authorization policy, validation, translations, and the
  explicit shared-persistence reference live in `shared`.
- `pallet` owns the `pallets` database schema and migrations.
- `auth` and `fis` use the shared persistence boundary because transactions and
  counters intentionally belong to the same consistency boundary.
- Calls to external FIS routers never run inside a SQL transaction. Database
  mutations enqueue durable `fis_outbox` jobs in the same transaction.

If any module is deployed independently in the future, it must first receive
its own database and communicate through Encore service clients or events.
