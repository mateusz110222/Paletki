# CI/CD Paletki

`pull request → lint + typy + testy + build + PostgreSQL`

`push master → te same kontrole → obrazy GHCR z SHA → runner produkcyjny → backup → migracje → start → kontrola API`

Build odbywa się na GitHub, a runner na serwerze tylko pobiera obrazy i wdraża.
Wszystkie trzy obrazy wydania mają ten sam tag SHA. Nie używamy `latest`.
Uruchomienie workflow ręcznie na `master` również buduje i wdraża wybrany commit.
Aktualizacja powoduje krótką przerwę działania aplikacji i wejścia maszyn FIS.

## 1. Środowiska

Lokalnie, w katalogu repozytorium:

```powershell
Copy-Item .env.development.example .env.development
pnpm dev
```

Uzupełnij własne wartości developerskie. Jeśli masz już działający lokalny `.env`,
możesz skopiować go do `.env.development`, ustawić `ENCORE_ENV=development`
i zweryfikować, czy wskazuje środowisko developerskie. Starszy `.env` nadal jest
fallbackiem; usuń go po przeniesieniu konfiguracji. Nie kopiuj haseł produkcyjnych
do pliku developerskiego.

Na serwerze przygotuj `/opt/paletki/.env.production` według
`.env.production.example`. Jeśli plik już istnieje, edytuj go zamiast nadpisywać.
Przenieś rzeczywiste wartości z obecnych zmiennych Portainera, w szczególności
**zachowaj obecne hasło PostgreSQL**. Szablon nie zawiera działających haseł.
Pliki `.env.development`, `.env.production` i `.env` są ignorowane przez Git.

Compose zawsze dostaje `--env-file` jawnie. Backend produkcyjny nie wczytuje
lokalnych plików `.env*`. Vite wczytuje `.env.development` przy `pnpm dev`,
a `.env.production` przy lokalnym `pnpm build`; konfiguracja publicznego frontendu
jest wbudowywana podczas buildu, nie przy uruchomieniu Nginx.

Obrazy CI używają API pod tym samym adresem co strona. Opcjonalne publiczne linki
do historii FIS ustaw w GitHub **Settings → Secrets and variables → Actions →
Variables**: `FIS1_UNIT_HISTORY_URL`, `FIS2_UNIT_HISTORY_URL`. Nie umieszczaj tam
haseł ani tokenów. Zmiana tych adresów wymaga nowego buildu.

## 2. Jednorazowe przejście z Portainera

Sprawdź nazwę projektu i wolumenu istniejącego kontenera PostgreSQL:

```bash
docker ps -a --filter label=com.docker.compose.service=postgres-db
docker inspect NAZWA_KONTENERA_POSTGRES --format '{{ index .Config.Labels "com.docker.compose.project" }}'
docker inspect NAZWA_KONTENERA_POSTGRES --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
```

W `.env.production` ustaw **dokładnie odczytane** wartości, np.:

```dotenv
COMPOSE_PROJECT_NAME=palletx
POSTGRES_VOLUME=palletx_pgdata
LDAP_CA_CERT_HOST_PATH=/opt/paletki/backend/certs/borgwarner-enterprise-root.pem
ENCORE_ENV=production
```

`POSTGRES_VOLUME` jest zewnętrznym, istniejącym wolumenem. Compose nie utworzy
nowego zamiast niego. Nie zmieniaj wersji PostgreSQL podczas tego przejścia.
Sprawdź, że wskazany PEM jest zwykłym, czytelnym plikiem na hoście.

Wyłącz automatyczne aktualizacje/webhooki starego stacka. Po przejściu deploymentem
zarządza ten workflow; Portainer służy do podglądu i logów. Nie aktualizuj starego
Compose w edytorze Portainera — przywróciłby stare obrazy i mounty. Nie usuwaj
wolumenu bazy ani nie wykonuj `down -v`. Nie trzeba usuwać istniejących kontenerów:
ten sam projekt Compose zostanie zaktualizowany w miejscu.

Przed pierwszym wdrożeniem zachowaj konfigurację starego stacka i wykonaj własną
kopię bazy. Skrypt dodatkowo tworzy backup przed każdą migracją.

## 3. Runner na plblo-pds-docker

Wymagania: Linux x64, Bash, Docker Engine, Docker Compose v2 z `--wait`,
`flock` (util-linux), `install` (coreutils), dostęp HTTPS do GitHub/GHCR
oraz rejestru obrazów Docker Hub. Nie trzeba otwierać portu SSH dla GitHub
ani instalować Node, pnpm i Encore na produkcji.

Utwórz dedykowanego użytkownika, np. `paletki-runner`, dodaj go do grupy `docker`
i zapewnij mu zapis w `/opt/paletki`, odczyt certyfikatu oraz odczyt pliku
`.env.production`. Ustaw właściciela `.env.production` na tego użytkownika
i uprawnienia `600`. Dostęp do Dockera daje runnerowi uprawnienia administracyjne
na hoście; tylko zaufani administratorzy powinni móc zmieniać workflow i `master`.

W repozytorium GitHub otwórz **Settings → Actions → Runners → New self-hosted
runner → Linux x64**. Wykonaj wyświetlone polecenia jako ten użytkownik w osobnym
katalogu, np. `/home/paletki-runner/actions-runner`. Podczas konfiguracji dodaj
etykietę **`paletki-production`**. Zainstaluj usługę systemową zgodnie z instrukcją
GitHub (`sudo ./svc.sh install paletki-runner`, `sudo ./svc.sh start`).

Repozytorium musi być zaufane; nie podłączaj tego runnera do workflow PR.
Ten workflow uruchamia PR wyłącznie na runnerach GitHub, a produkcję dopiero
po udanym publikowaniu z `master`.

## 4. GitHub i pierwsze uruchomienie

1. Utwórz GitHub Environment **`production`** i ogranicz deployment do `master`.
   Możesz dodać wymagane zatwierdzenie, jeśli nie chcesz pełnego automatu.
2. Włącz GitHub Actions i publikowanie GitHub Packages zgodnie z polityką organizacji.
   Workflow używa `GITHUB_TOKEN` do zapisu i odczytu GHCR; nie potrzebuje PAT.
   Dla już istniejących prywatnych pakietów przyznaj temu repozytorium dostęp w
   ustawieniach pakietu **Manage Actions access**. Dotyczy backend, frontend i migrations.
3. Jeśli aplikacja zostanie powiązana z Encore Cloud, dodaj sekret
   `ENCORE_AUTH_KEY`; obecna aplikacja ma puste `id`, więc go nie wymaga.
4. Wypchnij zmiany do `master`. Najpierw sprawdź udane CI i opublikowane obrazy.
5. Dopiero po przygotowaniu serwera ustaw zmienną repozytorium
   **`ENABLE_PRODUCTION_DEPLOY=true`** i uruchom workflow **CI / CD → Run workflow**
   na `master`. Kolejne pushe będą wdrażane automatycznie.

Tagi obrazów są przekazywane przez workflow i zapisywane po udanym wdrożeniu w
`/opt/paletki/release.production.env`. Pola obrazów w `.env.production` mogą
pozostać puste. Skrypt nigdy nie drukuje wynikowego Compose z hasłami.

## 5. Co sprawdza deployment

Skrypt blokuje równoległe wdrożenia, waliduje konfigurację i pobiera wszystkie
obrazy przed zatrzymaniem aplikacji. Po uruchomieniu bazy zatrzymuje frontend,
backend i workery, tworzy `pg_dump -Fc`, wykonuje migracje i czeka na gotowość
usług. Backend musi zwrócić HTTP 200 z `/public/dashboard`; końcowa kontrola
przechodzi dodatkowo przez Nginx. LDAP, APACS i routery FIS wymagają osobnego
testu operacyjnego.

Backupy trafiają do `/opt/paletki/backups` z uprawnieniami użytkownika runnera.
Nie są kasowane automatycznie: zapewnij miejsce na dysku i kopiowanie poza host.
Ustal retencję w ramach istniejącego systemu backupów.

## 6. Logi i odzyskiwanie

Po udanym wdrożeniu:

```bash
cd /opt/paletki
docker compose --env-file .env.production --env-file release.production.env -f compose.production.yml ps
docker compose --env-file .env.production --env-file release.production.env -f compose.production.yml logs --tail=100 backend db-migrations
```

Przy błędzie migracji aplikacja pozostaje zatrzymana. Backup jest zachowany,
a workflow kończy się błędem. Sprawdź log joba, nie wymuszaj wersji migracji
i nie uruchamiaj automatycznego cofania SQL. Napraw przyczynę i wykonaj nowe wydanie.
W razie nieudanego pierwszego wdrożenia pliki Compose i skrypt pozostają także
w checkoutcie runnera wskazanym w logu joba; manifest udanego wydania nie jest
nadpisywany przy błędzie.

Przed ręcznym powrotem do starszych obrazów upewnij się, że obsługują aktualny
schemat bazy. Sam powrót do starego SHA **nie cofa migracji**. Odtwarzanie backupu
wymaga zatrzymania wszystkich zapisów i świadomego wyboru punktu odzyskiwania.
Nie dodano automatycznego rollbacku bazy, aby nie usuwać danych zapisanych
po wdrożeniu.

Źródła: [Encore CI/CD](https://encore.dev/docs/self-host/ci-cd),
[obrazy w GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images),
[runner self-hosted](https://docs.github.com/en/actions/reference/runners/self-hosted-runners),
[tryby środowisk Vite](https://vite.dev/guide/env-and-mode).
