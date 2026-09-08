# Migracje dla pustej bazy

Ten zestaw tworzy od razu docelowy schemat.

Encore wykonuje pliki według numerów. Podział pozostaje w jednym katalogu,
zgodnie z konfiguracją `pallet/db.ts` i `encore.app`.

| Plik | Zawartość |
| --- | --- |
| `1_project_model_catalog.up.sql` | Projekty, modele należące do projektów, unikalność nazw i klucze modeli. |
| `2_pallet_inventory.up.sql` | Paletki z `project_id` i `model_id`, klucze obce, indeksy oraz widok `pallet_details` z aktualnymi nazwami. |
| `3_pallet_audit_and_rules.up.sql` | Historia paletek, jej indeksy, automatyczne kierowanie do mycia i wyzwalacze audytu. |
| `4_auth_sessions.up.sql` | Sesje logowania i indeks czasu wygaśnięcia. |
| `5_fis_outbox.up.sql` | Kolejka synchronizacji FIS, wszystkie jej indeksy i początkowy stan uzgadniania danych. |
| `6_production_tracking.up.sql` | Historia stanowisk z kluczem `(station, pallet_id)` oraz zdarzenia naliczania cykli. |

Indeksy są przy tabelach, których dotyczą. Poprawki kolejki FIS i klucza
stanowisk są częścią ich definicji. Nie ma tymczasowych kolumn nazw w paletkach,
przepisywania danych ani wyłączania wyzwalaczy na czas konwersji.

Po pierwszym wdrożeniu tego zestawu kolejne zmiany schematu należy dodawać
jako nowe migracje od numeru 7, bez zmieniania wykonanych plików.
