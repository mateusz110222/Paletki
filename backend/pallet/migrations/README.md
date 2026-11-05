# Migracje dla pustej bazy

Ten zestaw tworzy od razu docelowy schemat.

Encore wykonuje pliki według numerów. Podział pozostaje w jednym katalogu,
zgodnie z konfiguracją `pallet/db.ts` i `encore.app`.

| Plik                              | Zawartość                                                                                                   |
|-----------------------------------|-------------------------------------------------------------------------------------------------------------|
| `1_project_model_catalog.up.sql`  | Projekty, modele należące do projektów, unikalność nazw i klucze modeli.                                    |
| `2_pallet_inventory.up.sql`       | Paletki z `project_id` i `model_id`, klucze obce, indeksy oraz widok `pallet_details` z aktualnymi nazwami. |
| `3_pallet_audit_and_rules.up.sql` | Historia paletek, jej indeksy, automatyczne kierowanie do mycia i wyzwalacze audytu.                        |
| `4_auth_sessions.up.sql`          | Sesje logowania i indeks czasu wygaśnięcia.                                                                 |
| `5_fis_outbox.up.sql`             | Kolejka synchronizacji FIS, wszystkie jej indeksy i początkowy stan uzgadniania danych.                     |
| `6_production_tracking.up.sql`    | Historia stanowisk z kluczem `(station, pallet_id)` oraz zdarzenia naliczania cykli.                        |
| `7_defects_reports_machine.up.sql` | Słownik defektów, edytowalne zgłoszenia operatorów, maszyna WSM/SSM/COAT i zamykanie zgłoszeń po obsłudze. |
| `8_status_tracking_and_release_audit.up.sql` | Data wejścia w status i okresy serwisowe niezależne od audytu; bez wpisów automatycznego mycia; osobne odblokowanie. |

Indeksy są przy tabelach, których dotyczą. Poprawki kolejki FIS i klucza
stanowisk są częścią ich definicji. Nie ma tymczasowych kolumn nazw w paletkach ani wyłączania wyzwalaczy.
Migracje 7 i 8 uzupełniają maszynę, datę statusu i okresy serwisowe istniejących rekordów.

Po pierwszym wdrożeniu tego zestawu kolejne zmiany schematu należy dodawać
jako nowe migracje od numeru 13, bez zmieniania wykonanych plików.

## Migration 9 — APACS card login

`9_revoke_manual_operator_sessions.up.sql` deletes only `operator:` sessions created by manual NetID/station login. LDAP sessions and audit history are preserved. Users of the removed login method must sign in with an APACS card or LDAP.

## Migration 10 — moving models between projects

`10_move_models_between_projects.up.sql` adds `ON UPDATE CASCADE` to the composite model/project foreign key. Moving a model updates all linked pallets in the same transaction, including archived pallets. IDs, counters and existing audit history are preserved; deletion remains restricted.

## Migration 11 — employee name lengths

`11_employee_name_lengths.up.sql` widens employee-name columns in pallets, audit logs and operator reports to 256 characters, matching authentication sessions. It recreates `pallet_details` with the same fields because PostgreSQL prevents changing the type of a column referenced by a view. Existing names and history are preserved.

## Migration 12 — FIS worker leases

`12_fis_outbox_lease_token.up.sql` adds a UUID ownership token to outbox jobs. Workers claim one job immediately before execution and update outcomes only while they own its lease. Expired jobs remain recoverable; the lease also covers the configured FIS request timeout and cleanup. Deploy with the updated backend before restarting scheduler workers.
