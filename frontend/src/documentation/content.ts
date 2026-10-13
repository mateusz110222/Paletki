export type DocLanguage = 'pl' | 'en';
export type DocBlock =
    | {kind: 'paragraph' | 'heading' | 'note' | 'code'; text: string}
    | {kind: 'steps' | 'flow'; items: string[]}
    | {kind: 'table'; headers: string[]; rows: string[][]};
export type DocLinkAccess = 'all' | 'manage' | 'maintenance' | 'operator' | 'it';
export interface DocSection {
    id: string;
    group: 'guide' | 'technical';
    title: string;
    description: string;
    blocks: DocBlock[];
    link?: {to: string; label: string; access: DocLinkAccess};
}
export interface DocumentationAccess {
    canManagePallets: boolean;
    canAccessMaintenance: boolean;
    isMaintenanceOnly: boolean;
    hasITDepartmentAccess: boolean;
}
type Pair<T> = Record<DocLanguage, T>;
const pair = <T,>(pl: T, en: T): Pair<T> => ({pl, en});
const paragraph = (pl: string, en: string): Pair<DocBlock> => pair({kind: 'paragraph', text: pl}, {kind: 'paragraph', text: en});
const note = (pl: string, en: string): Pair<DocBlock> => pair({kind: 'note', text: pl}, {kind: 'note', text: en});
const heading = (pl: string, en: string): Pair<DocBlock> => pair({kind: 'heading', text: pl}, {kind: 'heading', text: en});
const steps = (pl: string[], en: string[]): Pair<DocBlock> => pair({kind: 'steps', items: pl}, {kind: 'steps', items: en});
const flow = (pl: string[], en: string[]): Pair<DocBlock> => pair({kind: 'flow', items: pl}, {kind: 'flow', items: en});
const code = (text: string): Pair<DocBlock> => pair({kind: 'code', text}, {kind: 'code', text});
const table = (headers: Pair<string[]>, rows: Pair<string[][]>): Pair<DocBlock> => pair(
    {kind: 'table', headers: headers.pl, rows: rows.pl}, {kind: 'table', headers: headers.en, rows: rows.en},
);
interface SectionSource {
    id: string;
    group: DocSection['group'];
    title: Pair<string>;
    description: Pair<string>;
    blocks: Pair<DocBlock>[];
    link?: {to: string; label: Pair<string>; access: DocLinkAccess};
}

const source: SectionSource[] = [
    {
        id: 'getting-started', group: 'guide', title: pair('Pierwsze kroki i dostęp', 'Getting started and access'),
        description: pair('Wybierz właściwy panel i poznaj obieg paletki.', 'Choose the right panel and understand the pallet lifecycle.'),
        blocks: [
            paragraph('Paletki / PalletX prowadzi ewidencję palet lutowniczych: projekty, modele, gniazda, liczniki, stan techniczny i historię obsługi. FIS1 lub FIS2 oznacza system przypisany do paletki. Dokumentacja opisuje aplikację z repozytorium oraz osobno starszą stronę lutowania.', 'Paletki / PalletX tracks soldering pallets: projects, models, nests, counters, condition and service history. FIS1 or FIS2 identifies the system assigned to a pallet. This guide covers the repository application and, separately, the older soldering page.'),
            steps(['Otwórz aplikację. Zaloguj się kontem firmowym LDAP albo uruchom sesję operatora, podając identyfikator pracownika.', 'Sprawdź nazwę użytkownika i język w nagłówku. Dostępne pozycje menu wynikają z uprawnień.', 'Operator zgłasza problemy, UR obsługuje mycie i naprawy, ME/IT zarządza ewidencją.', 'Wyszukaj paletkę i sprawdź status oraz licznik przed dalszą pracą.'], ['Open the application. Sign in with your corporate LDAP account or start an operator session with your employee identifier.', 'Check the user name and language in the header. Menu entries depend on your permissions.', 'Operators report issues, maintenance services pallets, and ME/IT manages the inventory.', 'Find the pallet and check its status and counter before continuing.']),
            table(pair(['Dostęp', 'Możliwości'], ['Access', 'Capabilities']), pair([
                ['Operator', 'Skanowanie i zgłoszenia: Damaged lub Washing_Required, bez zerowania liczników. Brak zarządzania ewidencją.'],
                ['UR — domyślnie Maintenance', 'Mycie i naprawy paletek Damaged/Washing_Required; powrót do Active z resetem albo zgłoszenie uszkodzenia bez resetu.'],
                ['ME — domyślnie proceng', 'Projekty, modele, ewidencja, historia i obsługa serwisowa. Bez katalogu LDAP.'],
                ['IT — fisadmin_group / admin_group', 'Wszystkie panele, w tym sprawdzanie użytkownika w katalogu LDAP.'],
            ], [
                ['Operator', 'Scanning and reports: Damaged or Washing_Required, without resetting counters. No inventory management.'],
                ['UR — Maintenance by default', 'Service Damaged/Washing_Required pallets; return to Active with a reset, or report damage without a reset.'],
                ['ME — proceng by default', 'Projects, models, inventory, history and maintenance. No LDAP directory.'],
                ['IT — fisadmin_group / admin_group', 'All panels, including LDAP user lookup.'],
            ])),
            note('Sesja operatora nie jest logowaniem LDAP. Widoczność dokumentacji nie nadaje uprawnień do operacji. Backend ponownie sprawdza dostęp; po wygaśnięciu sesji zaloguj się ponownie.', 'An operator session is not an LDAP login. Reading documentation does not grant operation permissions. The backend checks access again; sign in again when your session expires.'),
            flow(['Rejestracja', 'Active / produkcja', 'Mycie lub naprawa', 'Obsługa i reset', 'Active'], ['Registration', 'Active / production', 'Washing or repair', 'Service and reset', 'Active']),
        ],
    },
    {
        id: 'catalog', group: 'guide', title: pair('Projekty i modele', 'Projects and models'),
        description: pair('Katalog wspólnych parametrów paletek — dla ME i IT.', 'Shared pallet classification — for ME and IT.'),
        blocks: [
            steps(['Otwórz „Projekty i modele” i dodaj projekt produkcyjny.', 'Dodaj model przypisany do tego projektu. Nazwy powinny jednoznacznie identyfikować rzeczywiste wyposażenie.', 'Podczas dodawania paletki wybierz najpierw projekt, potem model z jego listy.', 'Zmianę nazwy wykonuj w katalogu. Jest widoczna na powiązanych paletkach. Usuwaj tylko wpisy bez zależnych modeli i paletek.'], ['Open “Projects and models” and add a production project.', 'Add a model assigned to that project. Names should clearly identify the physical equipment.', 'When registering a pallet, select the project first, then a model from its list.', 'Rename entries in the catalog. Linked pallets show the new name. Delete only entries without dependent models or pallets.']),
            note('Nie wpisuj modelu z innego projektu. Brak modelu na liście oznacza, że trzeba go najpierw utworzyć w odpowiednim projekcie.', 'Do not use a model from another project. If a model is missing, create it under the correct project first.'),
        ], link: {to: '/catalog', label: pair('Otwórz katalog', 'Open catalog'), access: 'manage'},
    },
    {
        id: 'registration', group: 'guide', title: pair('Dodawanie paletek', 'Registering pallets'),
        description: pair('Pojedynczy numer lub kompletny zakres z podglądem limitów.', 'One serial number or a complete range with cycle limit previews.'),
        blocks: [
            steps(['W panelu zarządzania wybierz dodawanie pojedynczej paletki albo zakresu.', 'Podaj unikalny identyfikator, projekt, model, FIS, liczbę gniazd i dodatni limit cykli.', 'Dla zakresu podaj pierwszy i ostatni numer: wspólny prefiks i dwie ostatnie cyfry, np. PROJECT-01 → PROJECT-12.', 'Opcjonalnie ustaw stopniowanie limitu w zakresie: co ile paletek i o ile zmniejszać limit. Sprawdź podgląd; każdy limit musi pozostać dodatni.', 'Wybierz status; dla Blocked podaj powód. Zapisz i sprawdź obecność nowych rekordów.'], ['In the management panel choose a single pallet or a range.', 'Enter a unique ID, project, model, FIS, number of nests and a positive cycle limit.', 'For a range enter the first and last ID: a shared prefix and a final two-digit number, e.g. PROJECT-01 → PROJECT-12.', 'Optionally decrease the limit across a range: choose the interval and decrement. Check the preview; every limit must remain positive.', 'Select a status; provide a reason for Blocked. Save and check the new records.']),
            note('Zakres zapisywany jest atomowo: konflikt numeru lub niepoprawny parametr odrzuca całą operację. Istniejący aktywny numer nie może być ponownie dodany. Identyfikatory są normalizowane do wielkich liter.', 'Ranges are saved atomically: a conflicting ID or invalid parameter rejects the whole operation. An existing non-deleted ID cannot be added again. IDs are normalized to uppercase.'),
            code('PROJECT-01 → PROJECT-06\nmax_cycles = 100, cycle_step_every = 2, cycle_step_amount = 10\n01/02: 100   03/04: 90   05/06: 80'),
        ], link: {to: '/admin', label: pair('Otwórz ewidencję', 'Open inventory'), access: 'manage'},
    },
    {
        id: 'inventory', group: 'guide', title: pair('Ewidencja, kopiowanie i edycja', 'Inventory, copying and editing'),
        description: pair('Znajdź paletkę i zmień jej parametry zgodnie z uprawnieniami ME/IT.', 'Find a pallet and manage its settings with ME/IT access.'),
        blocks: [
            steps(['Wyszukaj numer paletki, projekt lub model; użyj filtrów, sortowania i stronicowania tabeli.', 'Otwórz edycję, aby zmienić FIS, gniazda, limit lub status. Projekt i model wybierane są podczas rejestracji; ich nazwy zmienia się w katalogu.', 'Akcja kopiowania wypełnia formularz nowej paletki projektem, modelem, limitem, gniazdami i FIS. Wpisz nowy, unikalny numer.', 'Po zapisaniu sprawdź parametry oraz historię paletki.'], ['Search by pallet ID, project or model; use filters, sorting and pagination.', 'Open editing to change FIS, nests, limit or status. Project and model are selected at registration; rename them in the catalog.', 'Copy pre-fills a new pallet form with project, model, limit, nests and FIS. Enter a new unique ID.', 'After saving, check the settings and pallet history.']),
            note('Obniżenie limitu do wartości nie większej niż current_cycles może od razu skierować aktywną paletkę do mycia. Odblokowanie bez resetu nie usuwa przekroczonego limitu.', 'Lowering the limit to current_cycles or below can immediately send an active pallet to washing. Unblocking without a reset does not remove a reached limit.'),
        ], link: {to: '/admin', label: pair('Przejdź do zarządzania', 'Go to management'), access: 'manage'},
    },
    {
        id: 'deletion', group: 'guide', title: pair('Usuwanie i reaktywacja', 'Deletion and reactivation'),
        description: pair('Wycofanie paletki z ewidencji i ponowne użycie jej numeru.', 'Retire a pallet from inventory and reuse its ID.'),
        blocks: [
            steps(['ME/IT wybiera usunięcie w ewidencji i potwierdza wycofanie właściwego numeru.', 'Rekord jest oznaczany jako usunięty; znika z bieżącej ewidencji i interfejsu lutowania, a historia pozostaje w bazie.', 'Aby reaktywować numer, dodaj go ponownie z właściwym projektem, modelem i parametrami.', 'Sprawdź nowy stan i historię. Reaktywacja zeruje current_cycles oraz total_cycles.'], ['ME/IT selects deletion in the inventory and confirms the correct ID.', 'The record is marked as deleted; it disappears from current inventory and the soldering interface, while history remains in the database.', 'To reactivate the ID, register it again with the correct project, model and settings.', 'Check the new state and history. Reactivation resets both current_cycles and total_cycles.']),
            note('Zwykła obsługa serwisowa zachowuje total_cycles; reaktywacja jest inną operacją. Zlecenie synchronizacji usunięcia trafia do kolejki FIS, więc jej wykonanie może nastąpić później.', 'Normal service preserves total_cycles; reactivation is a different operation. FIS deletion is queued and may complete later.'),
        ],
    },
    {
        id: 'status-counters', group: 'guide', title: pair('Statusy i liczniki', 'Statuses and counters'),
        description: pair('Co oznacza stan paletki, limit mycia i wynik procesu.', 'Understand pallet condition, washing limits and process results.'),
        blocks: [
            table(pair(['Status paletki', 'Znaczenie', 'Dalsze działanie'], ['Pallet status', 'Meaning', 'Next action']), pair([
                ['Active', 'Paletka dopuszczona przez stan ewidencji; nadal musi być poniżej limitu.', 'Użycie w produkcji po kontrolach procesu.'],
                ['Washing_Required', 'Wymaga mycia; również automatycznie po osiągnięciu limitu.', 'Przekaż do UR; po obsłudze wróć do Active z resetem.'],
                ['Damaged', 'Zgłoszone uszkodzenie.', 'Naprawa i opis obsługi przed powrotem.'],
                ['Blocked', 'Blokada administracyjna z powodem.', 'Wyjaśnij z ME/IT; skaner pokaże powód blokady bez możliwości zgłoszenia defektu.'],
            ], [
                ['Active', 'Inventory condition permits use; the pallet must still be below its limit.', 'Production use after process checks.'],
                ['Washing_Required', 'Needs washing; also set automatically when the limit is reached.', 'Send to maintenance; return to Active with a reset after service.'],
                ['Damaged', 'Damage has been reported.', 'Repair and record service before returning.'],
                ['Blocked', 'Administrative block with a reason.', 'Contact ME/IT; the scanner shows the reason without allowing fault reports.'],
            ])),
            table(pair(['Pole', 'Jak je czytać'], ['Field', 'How to read it']), pair([
                ['current_cycles', 'Cykle od ostatniego resetu; zerowane po obsłudze.'], ['total_cycles', 'Łączny licznik; zwykłe mycie/naprawa go nie zeruje. Reaktywacja zeruje oba liczniki.'], ['max_cycles', 'Próg mycia: current_cycles >= max_cycles zmienia Active na Washing_Required.'], ['nests', 'Liczba gniazd, nie licznik cykli ani liczba zgłoszeń.'],
            ], [
                ['current_cycles', 'Cycles since the last reset; reset after service.'], ['total_cycles', 'Lifetime count; normal washing/repair preserves it. Reactivation resets both counters.'], ['max_cycles', 'Washing threshold: current_cycles >= max_cycles changes Active to Washing_Required.'], ['nests', 'Number of nests, not a cycle or report count.'],
            ])),
            paragraph('Status paletki nie jest wynikiem testu sztuki ani statusem maszyny. Komunikat „Proces poprawny” dotyczy zapisu procesu. Przypisanie do stanowiska opisuje ostatnio używaną paletkę/projekt, nie gotowość techniczną maszyny.', 'Pallet status is not a unit test result or a machine status. “Process successful” concerns the process record. A station assignment describes the recently used pallet/project, not the machine’s technical readiness.'),
            note('W Encore cykl zwiększa oba liczniki o 1. Cykl osiągający limit jest zapisany, a odpowiedź może już zawierać Washing_Required. Następny cykl takiej paletki jest odrzucany.', 'In Encore a cycle increments both counters by 1. The cycle reaching the limit is recorded, and its response may already contain Washing_Required. The next cycle for that pallet is rejected.'),
        ],
    },
    {
        id: 'reports-defects-machines', group: 'guide', title: pair('Defekty, raporty i maszyny', 'Defects, reports and machines'),
        description: pair('Słownik UR, edycja zgłoszeń, eksport Excel i przypisanie maszyny.', 'Maintenance catalog, report editing, Excel export and machine assignments.'),
        blocks: [
            paragraph('W menu UR wybierz Serwis i mycie, Skaner po myciu, Słownik defektów lub Historia paletki. UR/ME/IT zarządza słownikiem na osobnym ekranie: dodaje, zmienia nazwę i usuwa wpisy. Usunięcie pozycji zachowuje jej nazwę w zapisanych zgłoszeniach. Operator wybiera defekt lub Inne; wszystkie defekty oznaczają Damaged, a mycie jest osobną akcją.', 'In Maintenance choose Service and washing, After-washing scanner, Defect catalog or Pallet history. UR/ME/IT manages defects on a separate screen: add, rename and delete. Deleting a catalog entry retains its name in saved reports. Operators choose a defect or Other; defects mean Damaged, while washing is a separate action.'),
            note('Edycja otwartego zgłoszenia nadpisuje jego treść i istniejący wpis historii. Poprzednia treść nie jest archiwizowana i nie powstaje dodatkowy wpis korekty. Autor i data zgłoszenia pozostają; wyświetlana jest ostatnia edycja. Zgłoszenia mycia są zapisywane osobno; UR może poprawić ich opis bez zmiany statusu. Zakończenie obsługi zamyka otwarte zgłoszenia.', 'Editing an open report overwrites its content and existing history entry. Previous text is not archived and no correction event is created. Original author and report date remain; the last edit is shown. Washing reports are recorded separately; maintenance can edit their description without changing status. Service completion closes open reports.'),
            paragraph('Odblokowanie wymaga komentarza i jest prezentowane w historii jako osobne zdarzenie. Automatyczne przejście do mycia po osiągnięciu limitu nie tworzy wpisu audytu; data wejścia w status i czasy serwisu nadal są mierzone. Maszyna WSM, SSM lub COAT jest wymagana przy dodawaniu paletki i zakresu. Kopiowanie przenosi maszynę; edycja pozwala ją zmienić. Pole nie zależy od FIS. Istniejące paletki otrzymują WSM.', 'Unblocking requires a comment and appears as a separate history event. Automatically entering washing at the cycle limit creates no audit entry; status entry dates and service times are still tracked. WSM, SSM or COAT is required for single and range registration. Copying carries the machine; editing can change it. It is independent of FIS. Existing pallets receive WSM.'),
            steps(['Otwórz Raporty jako UR, ME lub IT.', 'Wybierz historię zdarzeń albo bieżący stan. Zaznacz statusy i zakres dat; brak wyboru oznacza wszystkie dane.', 'Daty obejmują całe dni w Europe/Warsaw. W bieżącym stanie jest to data wejścia w status, nie ostatniego cyklu.', 'Pobierz XLSX: eksport zawiera wszystkie wyniki filtrów, również poza widoczną stroną. Projekt, model i maszyna pokazują bieżące dane.'], ['Open Reports as UR, ME or IT.', 'Choose event history or current state. Select statuses and dates; leaving filters empty includes all data.', 'Dates include complete days in Europe/Warsaw. Current state uses status entry time, not the latest production cycle.', 'Download XLSX: export contains every filtered row, including other pages. Project, model and machine show current data.']),
        ], link: {to: '/reports', label: pair('Otwórz raporty', 'Open reports'), access: 'maintenance'},
    },
    {
        id: 'operator', group: 'guide', title: pair('Panel operatora', 'Operator panel'),
        description: pair('Skanowanie i zgłaszanie problemów bez zerowania liczników.', 'Scan and report issues without resetting counters.'),
        blocks: [
            steps(['Uruchom sesję operatora lub użyj konta z dostępem do panelu. Zeskanuj numer paletki i zatwierdź.', 'Sprawdź status, parametry i komunikat. Damaged i Blocked pokazują kartę z powodem bez możliwości zgłaszania. Washing_Required można otworzyć do zgłoszenia, ale ostrzeżenie nie oznacza dopuszczenia do lutowania.', 'Wybierz typ problemu, wpisz opis i potwierdź zgłoszenie.', 'Po sukcesie sprawdź komunikat; przy błędzie popraw opis lub zgłoś problem z połączeniem.'], ['Start an operator session or use an account with panel access. Scan the pallet ID and submit.', 'Check status, settings and feedback. Damaged and Blocked pallets display a read-only reason card. Washing_Required pallets can be opened for reporting; a warning does not authorize soldering.', 'Choose the issue type, enter a description and confirm.', 'Check the success message; on error correct the description or report a connection issue.']),
            table(pair(['Skrót', 'Zgłoszenie', 'Zapisany status'], ['Shortcut', 'Report', 'Recorded status']), pair([
                ['1', 'Uszkodzenia mechaniczne — modal z wyborem defektu', 'Damaged'], ['2', 'Wymagane mycie', 'Washing_Required'], ['3', 'Inne — wymagany opis', 'Damaged'],
            ], [
                ['1', 'Mechanical damage — dialog with defect selection', 'Damaged'], ['2', 'Washing required', 'Washing_Required'], ['3', 'Other — description required', 'Damaged'],
            ])),
            paragraph('Skróty działają w kontekście otwartej paletki, poza edytowanymi polami formularza. Możesz wyłączyć dźwięk skanowania lub zmienić głośność. Pole opisu pojawia się i jest wymagane tylko po wybraniu Inne; mycie zgłasza się bez komentarza. Zgłoszenie nie resetuje cykli. Zablokowana paletka pokazuje powód blokady, a zgłoszenia są niedostępne.', 'Shortcuts apply to an opened pallet outside editable form fields. You can mute scan sounds or adjust volume. The description field appears and is required only for Other; washing is reported without a comment. Reports do not reset cycles. Blocked pallets display their reason and cannot receive reports.'),
        ], link: {to: '/operator', label: pair('Otwórz panel operatora', 'Open operator panel'), access: 'operator'},
    },
    {
        id: 'maintenance', group: 'guide', title: pair('Mycie i naprawy', 'Washing and repairs'),
        description: pair('Kolejka UR oraz udokumentowany powrót do produkcji.', 'Maintenance queues and a documented return to production.'),
        blocks: [
            steps(['UR/ME/IT otwiera panel utrzymania. Wybierz naprawy (Damaged) lub obsługę okresową (Washing_Required).', 'Wyszukaj numer i wykonaj wymaganą czynność zgodnie z procedurą zakładową.', 'Otwórz zapis obsługi i opisz wykonane mycie albo naprawę. Pusty opis jest odrzucany.', 'Zatwierdź powrót do produkcji: Active, current_cycles = 0, zachowany total_cycles.', 'Jeżeli podczas mycia wykryto uszkodzenie, zgłoś Damaged bez resetowania liczników.'], ['UR/ME/IT opens maintenance. Choose repairs (Damaged) or routine service (Washing_Required).', 'Find the ID and perform the required work according to the site procedure.', 'Open the service form and describe the washing or repair. Empty descriptions are rejected.', 'Confirm return to production: Active, current_cycles = 0, total_cycles preserved.', 'If washing reveals damage, report Damaged without resetting counters.']),
            note('UR bez uprawnień ME/IT obsługuje tylko paletki Damaged/Washing_Required. Paletki Blocked wymagają decyzji ME/IT. Sama zmiana wpisu nie zastępuje fizycznej obsługi.', 'UR without ME/IT access can service only Damaged/Washing_Required pallets. Blocked pallets require an ME/IT decision. Updating a record does not replace physical service.'),
            paragraph('Skaner po myciu w menu UR pozwala zeskanować aktywną paletkę lub paletkę wymagającą mycia i ręcznie potwierdzić wykonane mycie. Można użyć go przed osiągnięciem limitu. Zerowany jest current_cycles, total_cycles pozostaje zachowany. Komentarz jest opcjonalny. Blokady i uszkodzenia obsłuż osobno; jeśli licznik zmienił się po skanie, zeskanuj paletkę ponownie. Potwierdzenie mycia tworzy jeden wpis historii.', 'The After-washing scanner in Maintenance accepts active pallets and pallets requiring washing, then asks for manual confirmation that washing is complete. It can be used before the cycle limit. It resets current_cycles and retains total_cycles. A comment is optional. Blocks and damage need separate service; if the count changes after scanning, scan again. Washing confirmation creates one history event.'),
        ], link: {to: '/maintenance/service', label: pair('Otwórz kolejkę obsługi', 'Open service queue'), access: 'maintenance'},
    },
    {
        id: 'history', group: 'guide', title: pair('Historia i eksporty', 'History and exports'),
        description: pair('Sprawdź kto, kiedy i dlaczego zmienił paletkę — dostęp ME/IT.', 'See who changed a pallet, when and why — ME/IT access.'),
        blocks: [
            steps(['Z ewidencji otwórz historię wybranej paletki albo w UR wybierz Historia paletki i zeskanuj jej ID.', 'Sprawdź czas, pracownika/źródło, poprzedni i nowy status oraz opis.', 'Zawęź wpisy wyszukiwaniem, typem zdarzenia, statusem i operatorem; wybierz kolejność.', 'Eksport CSV historii obejmuje aktualnie przefiltrowany zbiór, nie tylko widoczną stronę. Eksport audytu z panelu zarządzania pobiera historię do JSON.'], ['Open a pallet’s history from the inventory or choose Pallet history in Maintenance and scan its ID.', 'Check time, employee/source, previous and new status, and description.', 'Filter by text, event type, status and operator; choose ordering.', 'History CSV exports the currently filtered dataset, not just the visible page. The management audit export downloads history as JSON.']),
            note('Zwykłe zwiększenie liczników cyklu nie tworzy osobnego wpisu audytu paletki. Osiągnięcie limitu i zmiana statusu są rejestrowane. Audyt zmian nie jest pełnym dziennikiem testów sztuk.', 'A normal cycle counter increment does not create a separate pallet audit entry. Reaching the limit and changing status are recorded. The change audit is not a complete unit test log.'),
        ], link: {to: '/admin', label: pair('Wybierz paletkę w ewidencji', 'Choose a pallet in inventory'), access: 'manage'},
    },
    {
        id: 'dashboards', group: 'guide', title: pair('Monitory publiczne', 'Public monitors'),
        description: pair('Stanowiska, dostępność paletek i kolejka serwisowa bez logowania.', 'Stations, pallet availability and service queues without signing in.'),
        blocks: [
            steps(['W menu Dashboard wybierz Monitor Live lub Dashboard operacyjny, następnie wybierz stanowisko albo „Wszystkie projekty”.', 'Użyj ?station=SOLDER11, aby wejść bezpośrednio na stanowisko, albo ?station=ALL dla pełnego przeglądu.', 'Sprawdź dostępność, mycie i naprawy. /dashboard zawiera kolejkę, prognozę mycia oraz statystyki obsługi.', 'Dane odświeżają się co 30 sekund. Wybór stanowiska opiera się na zapisanych przypisaniach produkcyjnych.'], ['In Dashboard choose Live monitor or Operations dashboard, then select a station or “All projects”.', 'Use ?station=SOLDER11 to open a station directly, or ?station=ALL for the full overview.', 'Check availability, washing and repairs. /dashboard includes queues, washing forecasts and service statistics.', 'Data refreshes every 30 seconds. Station selection uses recorded production assignments.']),
            note('Prognoza mycia na dashboardzie zaczyna się przy 80% limitu; ostrzeżenia na stronie lutowania mają inne progi (95% lub do 20 pozostałych cykli). Publiczny feed nie zawiera nazwisk, komentarzy serwisowych, powodów blokady ani surowej historii.', 'The dashboard washing forecast starts at 80% of the limit; the soldering page uses different warning thresholds (95% or up to 20 remaining cycles). The public feed excludes employee names, service comments, block reasons and raw history.'),
        ], link: {to: '/dashboards', label: pair('Otwórz dashboard', 'Open dashboard'), access: 'all'},
    },
    {
        id: 'soldering-current', group: 'guide', title: pair('Lutowanie — obecna strona FIS', 'Soldering — current FIS page'),
        description: pair('Wariant z soldering.php, sprawdzony przez odczyt strony 8 października 2026.', 'The soldering.php variant, inspected by reading the page on 8 October 2026.'),
        blocks: [
            paragraph('Adres: http://10.142.11.30/cst_public/jj00sp_soldering.cgi. Odczytany skrypt /custom/jj00sp/js/soldering.js korzysta z /custom/jj00sp/php/soldering.php. Jest to inna wersja niż integration/soldering.js w repozytorium Paletki. Wnioski poniżej wynikają z HTML i JavaScript, bez wykonywania procesu produkcyjnego i bez wglądu w implementację PHP.', 'Address: http://10.142.11.30/cst_public/jj00sp_soldering.cgi. The inspected /custom/jj00sp/js/soldering.js calls /custom/jj00sp/php/soldering.php. This differs from integration/soldering.js in the Paletki repository. The following observations come from HTML and JavaScript, without running production operations or inspecting the PHP implementation.'),
            steps(['Sprawdź proces i stanowisko w nagłówku. Zeskanuj numer w „Scan pallet” i zatwierdź.', 'whichFis pobiera FIS i gniazda; odczytany wariant przekierowuje dla FIS1 na odpowiedni host, przekazując numer w URL.', 'palletCheck sprawdza możliwość użycia. Komunikaty obejmują blokadę, brak palety, powiązane sztuki i błędy bazy.', 'Po osiągnięciu limitu użyj innej palety i oddaj tę do czyszczenia. Ostrzeżenia pojawiają się przy 95% lub do 20 pozostałych cykli; w tym skrypcie próg 95% ma pierwszeństwo.', 'Jeśli konfiguracja wymaga kontroli podciśnienia, zapoznaj się z instrukcją, odczekaj 15 sekund i wykonaj wymaganą kontrolę przed „KONTYNUUJ”.', 'Wypełnij skany sztuk i wymaganych komponentów dla gniazd. Pola zależą od konfiguracji produktu. Skrypt wywołuje dataEntry i palletEntry.', '„Reset” przeładowuje stronę i formularz. Nie oznacza potwierdzonego resetu liczników ani cofnięcia zapisanych operacji.'], ['Check process and station in the header. Scan an ID in “Scan pallet” and submit.', 'whichFis obtains the FIS and nests; the inspected variant redirects FIS1 pallets to its host with the ID in the URL.', 'palletCheck checks usability. Messages cover blocks, missing pallets, linked units and database errors.', 'At the limit use another pallet and send this one for cleaning. Warnings appear at 95% or up to 20 remaining cycles; this script prioritizes 95%.', 'If configuration requires a vacuum check, read the instructions, wait 15 seconds and perform the required check before “CONTINUE”.', 'Scan units and required components for the nests. Fields depend on product configuration. The script calls dataEntry and palletEntry.', '“Reset” reloads the page and form. It does not establish that counters were reset or saved operations rolled back.']),
            note('Kod strony wyświetla sukces procesu po wywołaniu palletEntry bez sprawdzenia jego biznesowego potwierdzenia w pokazanych ścieżkach. Nie traktuj koloru komunikatu jako niezależnego dowodu poprawnego zapisu licznika. Transakcyjność i ponawianie po stronie PHP nie zostały potwierdzone.', 'In the inspected paths the page displays process success after calling palletEntry without checking its business acknowledgement. Message color is not independent proof that the counter was saved. PHP transaction and retry behavior has not been verified.'),
        ],
    },
    {
        id: 'soldering-encore', group: 'guide', title: pair('Lutowanie — wariant Encore', 'Soldering — Encore variant'),
        description: pair('Integracja z repozytorium, opisana oddzielnie od działającej starszej strony.', 'Repository integration, documented separately from the running older page.'),
        blocks: [
            flow(['Skan palety', 'GET danych Encore', 'Kontrola statusu i limitu', 'Skany i zapis FIS', 'POST cyklu Encore', 'Potwierdzenie'], ['Scan pallet', 'GET Encore data', 'Check status and limit', 'Scan and save to FIS', 'POST Encore cycle', 'Acknowledgement']),
            steps(['Skrypt integration/soldering.js odczytuje paletkę z API pod //10.142.11.66:4000; pobiera FIS, status, liczniki i liczbę gniazd.', 'Dopuszcza tylko Active poniżej limitu. Paletki FIS2 na innym hoście przekierowuje do plblofis2.global.borgwarner.net.', 'Wyświetla ostrzeżenie najpierw dla <= 20 pozostałych cykli, a dopiero potem dla >= 95% limitu. Kontrola podciśnienia zależy od konfiguracji.', 'Sprawdza sztuki i powiązania przez router FIS; unitCheck korzysta z soldering-encore.php. Zapis procesu odbywa się przed zapisem cyklu.', 'POST cyklu przesyła station. Sukces wymaga poprawnego potwierdzenia z numerem, licznikami i statusem paletki.'], ['integration/soldering.js reads the pallet from //10.142.11.66:4000, including FIS, status, counters and nests.', 'It accepts only Active pallets below the limit. FIS2 pallets on another host redirect to plblofis2.global.borgwarner.net.', 'It first warns at <= 20 remaining cycles, then at >= 95% usage. Vacuum checks depend on configuration.', 'Units and relationships are checked through the FIS router; unitCheck uses soldering-encore.php. The process is saved before the cycle.', 'The cycle POST sends station. Success requires a valid acknowledgement with pallet ID, counters and status.']),
            note('Odczyty Encore mają timeout 12 sekund i do dwóch ponowień dla błędów transportu oraz HTTP 408/429/5xx. Zapis cyklu ma retries: 0. API cyklu nie przyjmuje klucza idempotencji. Po timeout nie powtarzaj procesu w ciemno: zapis FIS mógł się udać, a potwierdzenie cyklu mogło zaginąć. ME/IT powinno porównać stan zapisów i liczników.', 'Encore reads use a 12-second timeout and up to two retries for transport errors and HTTP 408/429/5xx. Cycle recording uses retries: 0. The cycle API accepts no idempotency key. After a timeout do not blindly repeat the process: FIS may have saved it and a cycle acknowledgement may be lost. ME/IT should compare process records and counters.'),
            table(pair(['Element', 'Obecna strona', 'Repozytorium Encore'], ['Element', 'Current page', 'Encore repository']), pair([
                ['Źródło danych paletki', 'soldering.php / whichFis i palletCheck', 'GET /fis/soldering/pallets/:pallet_id'], ['Zapis cyklu', 'soldering.php / palletEntry; wnętrze PHP niezweryfikowane', 'POST /fis/soldering/pallets/:pallet_id/cycles; bez ponawiania'], ['Kontrole sztuk', 'Operacje przez soldering.php', 'Router FIS i soldering-encore.php'], ['Potwierdzenie cyklu', 'Brak sprawdzenia biznesowego wyniku w odczytanych ścieżkach JS', 'Walidacja numeru, statusu i obu liczników'],
            ], [
                ['Pallet data source', 'soldering.php / whichFis and palletCheck', 'GET /fis/soldering/pallets/:pallet_id'], ['Cycle recording', 'soldering.php / palletEntry; PHP internals not verified', 'POST /fis/soldering/pallets/:pallet_id/cycles; no retry'], ['Unit checks', 'Operations through soldering.php', 'FIS router and soldering-encore.php'], ['Cycle acknowledgement', 'No business-result check in the inspected JS paths', 'Validation of ID, status and both counters'],
            ])),
        ],
    },
    {
        id: 'troubleshooting', group: 'guide', title: pair('Problemy i komunikaty', 'Troubleshooting and messages'),
        description: pair('Jak rozpoznać problem i przekazać go właściwemu zespołowi.', 'Identify the issue and contact the right team.'),
        blocks: [
            table(pair(['Objaw', 'Działanie'], ['Symptom', 'Action']), pair([
                ['Nieznany numer / PALLET_NOT_FOUND', 'Sprawdź skan i wielkie litery. ME/IT sprawdza rejestrację, usunięcie i właściwy FIS.'], ['PALLET_NOT_ACTIVE / limit', 'Użyj innej paletki; mycie lub naprawa w UR, blokada w ME/IT.'], ['Brak projektu/modelu', 'ME/IT uzupełnia katalog i przypisanie.'], ['Brak uprawnień / wygasła sesja', 'Zaloguj się ponownie. IT sprawdza grupy FIS; sam departament w LDAP nie nadaje dostępu.'], ['Błąd połączenia / timeout', 'Zapisz numer, stanowisko, czas i komunikat. IT sprawdza sieć, backend, FIS i kolejkę.'], ['FIS zapisany, brak potwierdzenia cyklu', 'Nie powtarzaj automatycznie. ME/IT porównuje zapis procesu i stan licznika.'],
            ], [
                ['Unknown ID / PALLET_NOT_FOUND', 'Check the scan and uppercase ID. ME/IT checks registration, deletion and the correct FIS.'], ['PALLET_NOT_ACTIVE / limit', 'Use another pallet; maintenance handles washing/repair, ME/IT handles blocks.'], ['Missing project/model', 'ME/IT completes the catalog and assignment.'], ['Permission denied / expired session', 'Sign in again. IT checks FIS groups; an LDAP department alone does not grant access.'], ['Connection error / timeout', 'Record ID, station, time and message. IT checks network, backend, FIS and queues.'], ['FIS saved, cycle acknowledgement missing', 'Do not automatically repeat. ME/IT compares the process record and counter.'],
            ])),
            paragraph('Zgłoszenie do utrzymania lub IT powinno zawierać numer paletki, nazwę stanowiska, wersję integracji (PHP lub Encore), czas, dokładny komunikat i wykonany krok. Nie dołączaj haseł ani tokenów sesji.', 'Reports to maintenance or IT should include pallet ID, station, integration version (PHP or Encore), time, exact message and attempted step. Do not include passwords or session tokens.'),
        ],
    },
    {
        id: 'architecture', group: 'technical', title: pair('Architektura i przepływ danych', 'Architecture and data flow'),
        description: pair('React, Encore, PostgreSQL i zewnętrzne systemy FIS.', 'React, Encore, PostgreSQL and external FIS systems.'),
        blocks: [
            paragraph('Backend jest modularnym monolitem Encore: moduły auth, pallet i fis są wdrażane razem. pallet zarządza schematem PostgreSQL; auth i fis korzystają ze wspólnej granicy persystencji. Frontend React/Vite komunikuje się przez Nginx.', 'The backend is an Encore modular monolith: auth, pallet and fis deploy together. pallet owns the PostgreSQL schema; auth and fis use the shared persistence boundary. The React/Vite frontend communicates through Nginx.'),
            flow(['Przeglądarka', 'Nginx :8082', 'Encore :8080', 'PostgreSQL'], ['Browser', 'Nginx :8082', 'Encore :8080', 'PostgreSQL']),
            flow(['Zmiana paletki + outbox w transakcji', 'Worker', 'Router FIS1/FIS2'], ['Pallet change + outbox in a transaction', 'Worker', 'FIS1/FIS2 router']),
            paragraph('Port 4000 udostępnia przez Nginx wyłącznie /fis/*. Operacje integracji lutowania nie używają sesji użytkownika, więc wdrożenie musi ograniczać dostęp sieciowy do zaufanych stanowisk. Zapis procesu w zewnętrznym FIS i zapis cyklu w Encore nie są jedną transakcją.', 'Nginx exposes only /fis/* on port 4000. Soldering integration operations do not use a user session, so deployment must restrict network access to trusted stations. An external FIS process record and an Encore cycle record are not one transaction.'),
            note('Endpoint PUT stanowiska istnieje w backendzie, ale odczytany lokalny skrypt lutowania go nie wywołuje. POST cyklu również aktualizuje przypisanie stanowiska. Obecność endpointu nie dowodzi, że starsza strona produkcyjna go używa.', 'The station PUT endpoint exists in the backend, but the inspected local soldering script does not call it. Cycle POST also updates station assignments. An endpoint’s existence does not establish that the older production page uses it.'),
        ],
    },
    {
        id: 'api', group: 'technical', title: pair('API i przykłady integracji', 'API and integration examples'),
        description: pair('Metody, ścieżki, uprawnienia i odpowiedzi interfejsu lutowania.', 'Methods, routes, permissions and soldering responses.'),
        blocks: [
            table(pair(['Metoda / ścieżka', 'Zastosowanie / dostęp'], ['Method / route', 'Purpose / access']), pair([
                ['POST /auth/login, /auth/operator-session', 'Logowanie LDAP lub sesja operatora. POST /auth/logout kończy zalogowaną sesję.'], ['GET /pallets, /pallets/:pallet_id', 'Ewidencja i pojedyncza paletka; sesja użytkownika.'], ['POST /pallets, /pallets/range; PUT/DELETE /pallets/:pallet_id', 'Rejestracja, zakres, edycja, usunięcie; ME/IT.'], ['POST /pallets/change-status', 'Status i opis; operator/UR/ME/IT zgodnie z regułami roli.'], ['POST /pallets/block, /pallets/unblock, /pallets/reset-cycles', 'Blokada, odblokowanie i reset; ME/IT.'], ['GET /pallets/:pallet_id/history', 'Historia paletki z paginacją; UR/ME/IT.'], ['GET /pallets/audit-history', 'Audyt wszystkich paletek; ME/IT.'], ['POST /pallets/confirm-washing', 'Potwierdzenie mycia i reset cykli dla Active/Washing_Required; UR/ME/IT. Wymaga licznika i wersji odczytanych podczas skanowania.'], ['GET/POST /projects, /models; PUT/DELETE /projects/:id, /models/:id', 'Odczyt katalogów publiczny; zapis ME/IT.'], ['GET /public/dashboard', 'Publiczny feed bez danych osobowych audytu.'],
            ], [
                ['POST /auth/login, /auth/operator-session', 'LDAP login or operator session. POST /auth/logout ends an authenticated session.'], ['GET /pallets, /pallets/:pallet_id', 'Inventory and individual pallet; user session.'], ['POST /pallets, /pallets/range; PUT/DELETE /pallets/:pallet_id', 'Registration, range, editing, deletion; ME/IT.'], ['POST /pallets/change-status', 'Status and description; operator/UR/ME/IT according to role rules.'], ['POST /pallets/block, /pallets/unblock, /pallets/reset-cycles', 'Block, unblock and reset; ME/IT.'], ['GET /pallets/:pallet_id/history', 'Paginated pallet history; UR/ME/IT.'], ['GET /pallets/audit-history', 'Bulk audit history; ME/IT.'], ['POST /pallets/confirm-washing', 'Confirm washing and reset cycles for Active/Washing_Required; UR/ME/IT. Requires the scanned counter and update version.'], ['GET/POST /projects, /models; PUT/DELETE /projects/:id, /models/:id', 'Catalog reads are public; writes require ME/IT.'], ['GET /public/dashboard', 'Public feed without personal audit data.'],
            ])),
            heading('Interfejs lutowania Encore', 'Encore soldering interface'),
            code('GET /fis/soldering/pallets/PROJECT-01\n// Response fields:\n// pallet_id, project, model, fis, nests, status, block_reason,\n// current_cycles, total_cycles, max_cycles\n\nPUT /fis/soldering/stations/SOLDER11/current-pallet\nContent-Type: application/json\n{"pallet_id":"PROJECT-01"}\n\nPOST /fis/soldering/pallets/PROJECT-01/cycles\nContent-Type: application/json\n{"station":"SOLDER11"}\n\n// Example response (values depend on the database):\n{"status":true,"pallet_id":"PROJECT-01","current_cycles":12,\n "total_cycles":212,"pallet_status":"Active"}'),
            paragraph('Numery paletek: 1–50 znaków A–Z, 0–9, kropka, myślnik lub podkreślenie. Stanowisko: 1–64 takie znaki; ALL jest zarezerwowane. Błędy zawierają details.reason, np. INVALID_PALLET_ID, INVALID_STATION, PALLET_NOT_FOUND, PALLET_NOT_ACTIVE i CYCLE_LIMIT_REACHED.', 'Pallet IDs: 1–50 characters A–Z, 0–9, dot, hyphen or underscore. Stations: 1–64 such characters; ALL is reserved. Errors include details.reason, such as INVALID_PALLET_ID, INVALID_STATION, PALLET_NOT_FOUND, PALLET_NOT_ACTIVE and CYCLE_LIMIT_REACHED.'),
            note('Przykłady PUT/POST pokazują format; nie są przyciskami wykonującymi operację. Zapis cyklu nie przyjmuje event_id i nie gwarantuje idempotencji ponownego żądania.', 'PUT/POST examples show formats, not executable action buttons. Cycle recording accepts no event_id and does not guarantee idempotent repeated requests.'),
        ],
    },
    {
        id: 'database', group: 'technical', title: pair('Baza danych i migracje', 'Database and migrations'),
        description: pair('Aktualny zestaw sześciu migracji dla pustej bazy PostgreSQL.', 'The current six-migration set for a fresh PostgreSQL database.'),
        blocks: [
            table(pair(['Migracja', 'Zawartość'], ['Migration', 'Contents']), pair([
                ['1_project_model_catalog.up.sql', 'Projekty i modele przypisane do projektów.'], ['2_pallet_inventory.up.sql', 'Paletki, klucze obce i widok pallet_details.'], ['3_pallet_audit_and_rules.up.sql', 'Audyt oraz trigger automatycznego skierowania do mycia.'], ['4_auth_sessions.up.sql', 'Sesje logowania i indeks wygaśnięcia.'], ['5_fis_outbox.up.sql', 'Kolejka synchronizacji i stan uzgadniania.'], ['6_production_tracking.up.sql', 'Przypisania stanowisk (station, pallet_id) i tabela soldering_cycle_events.'],
            ], [
                ['1_project_model_catalog.up.sql', 'Projects and project-scoped models.'], ['2_pallet_inventory.up.sql', 'Pallets, foreign keys and pallet_details view.'], ['3_pallet_audit_and_rules.up.sql', 'Audit and automatic washing trigger.'], ['4_auth_sessions.up.sql', 'Login sessions and expiry index.'], ['5_fis_outbox.up.sql', 'Synchronization queue and reconciliation state.'], ['6_production_tracking.up.sql', 'Station assignments (station, pallet_id) and soldering_cycle_events table.'],
            ])),
            paragraph('Encore stosuje migracje w kolejności numerów; Docker Compose uruchamia db-migrations przed backendem. Dla nowych zmian po wdrożeniu dodawaj migracje od numeru 7, nie edytuj już zastosowanych plików.', 'Encore applies migrations in numerical order; Docker Compose runs db-migrations before the backend. After deployment, add new changes as migrations starting at 7; do not edit already applied files.'),
            note('Obecny zestaw opisuje pustą bazę. Nie zakładaj, że zastępuje historię migracji wcześniejszego wdrożenia. Przed aktualizacją istniejącej instalacji porównaj wersję schematu i wykonaj kopię bazy. Sama tabela soldering_cycle_events nie oznacza, że obecny endpoint cyklu z niej korzysta.', 'This set targets a fresh database. Do not assume it replaces an earlier installation’s migration history. Before updating an existing installation, compare schema versions and back up the database. The existence of soldering_cycle_events does not mean the current cycle endpoint uses it.'),
        ],
    },
    {
        id: 'authentication', group: 'technical', title: pair('LDAP, grupy FIS i sesje', 'LDAP, FIS groups and sessions'),
        description: pair('Uwierzytelnianie firmowe i źródło uprawnień aplikacji.', 'Corporate authentication and the source of application permissions.'),
        blocks: [
            steps(['Skonfiguruj LDAPS, domenę logowania, bazę wyszukiwania i zaufany certyfikat CA.', 'Zapewnij połączenie backendu z MySQL FIS oraz SELECT do users.tbl_users, groups.groupList i wskazanych tabel członkostwa.', 'Sprawdź grupy: IT = fisadmin_group/admin_group, UR = FIS_UR_GROUP, ME = FIS_ME_GROUP.', 'Dla katalogu LDAP ustaw konto odczytu LDAP_LOOKUP_BIND_USER i jego sekret. IT może sprawdzić użytkownika po NetID.', 'Zweryfikuj osobno logowanie LDAP, sesję operatora oraz wygaśnięcie i wylogowanie.'], ['Configure LDAPS, login domain, search base and a trusted CA certificate.', 'Provide backend connectivity to FIS MySQL and SELECT on users.tbl_users, groups.groupList and referenced membership tables.', 'Check groups: IT = fisadmin_group/admin_group, UR = FIS_UR_GROUP, ME = FIS_ME_GROUP.', 'For directory lookup configure LDAP_LOOKUP_BIND_USER and its secret. IT can look up a user by NetID.', 'Verify LDAP login, operator sessions, expiry and logout separately.']),
            paragraph('Backend sprawdza grupy FIS przy logowaniu i uwierzytelnionych żądaniach. Błąd odczytu grup blokuje dostęp uprzywilejowany. AUTH_SESSION_TTL_MINUTES ma domyślnie 720 minut; frontend nie odtwarza wygasłej sesji.', 'The backend checks FIS groups at login and on authenticated requests. Group lookup failures deny privileged access. AUTH_SESSION_TTL_MINUTES defaults to 720 minutes; the frontend does not restore expired sessions.'),
        ], link: {to: '/directory', label: pair('Sprawdź użytkownika LDAP', 'Look up an LDAP user'), access: 'it'},
    },
    {
        id: 'outbox', group: 'technical', title: pair('Synchronizacja FIS i outbox', 'FIS synchronization and outbox'),
        description: pair('Trwała kolejka, ponowienia i uzgadnianie brakujących wpisów.', 'Durable queue, retries and reconciliation of missing records.'),
        blocks: [
            paragraph('Zmiany ewidencji zapisują zadanie synchronizacji w tej samej transakcji PostgreSQL. Worker wykonuje zewnętrzne wywołania FIS po zatwierdzeniu transakcji; awaria routera nie wycofuje zmiany paletki. To kolejka ewidencji, nie atomowy zapis procesu lutowania i cyklu.', 'Inventory changes enqueue synchronization in the same PostgreSQL transaction. The worker calls external FIS after commit; router failure does not roll back the pallet change. This is an inventory queue, not an atomic soldering-process and cycle record.'),
            table(pair(['Stan', 'Interpretacja'], ['State', 'Meaning']), pair([
                ['pending', 'Oczekuje na wykonanie.'], ['processing', 'Zadanie przejęte z dzierżawą; sprawdź wiek i wygasłe lease.'], ['completed', 'Zakończone; usuwane partiami po okresie retencji.'], ['dead', 'Wyczerpano ponowienia; sprawdź payload, last_error i docelowy FIS.'],
            ], [
                ['pending', 'Waiting to run.'], ['processing', 'Claimed with a lease; inspect age and expired leases.'], ['completed', 'Finished; pruned in batches after retention.'], ['dead', 'Retries exhausted; inspect payload, last_error and target FIS.'],
            ])),
            paragraph('Compose odpytuje worker co 5 sekund, a reconciler co 900 sekund. Reconciler przetwarza partie ewidencji; dzienny klucz zapobiega ponownemu kolejkowaniu tej samej operacji danego dnia. Domyślna retencja completed wynosi 30 dni. Pozostałe stany są zachowywane.', 'Compose polls the worker every 5 seconds and the reconciler every 900 seconds. Reconciliation processes inventory batches; a daily key prevents duplicate enqueueing of the same operation that day. Default completed retention is 30 days. Other states are preserved.'),
            note('Endpointy /internal/fis-outbox/process i /internal/fis-outbox/reconcile są dostępne w sieci Compose, nie przez opublikowane lokalizacje Nginx. Błąd synchronizacji wyjaśniaj na podstawie kolejki i odpowiedzi routera, nie przez ponowne dodawanie paletki.', 'The /internal/fis-outbox/process and /internal/fis-outbox/reconcile endpoints are available on the Compose network, not through published Nginx locations. Diagnose synchronization using queue records and router responses, rather than registering the pallet again.'),
        ],
    },
    {
        id: 'deployment', group: 'technical', title: pair('Konfiguracja i instalacja', 'Configuration and installation'),
        description: pair('Przygotowanie środowiska, build i wdrożenie Docker/Portainer.', 'Prepare the environment, build and deploy with Docker/Portainer.'),
        blocks: [
            steps(['Przygotuj Node.js 24, pnpm zgodny z packageManager (11.25.0), Encore CLI, Docker i Docker Compose.', 'W katalogu repozytorium wykonaj pnpm install. Skopiuj .env.example do .env i uzupełnij wartości dla swojego środowiska.', 'Skonfiguruj PostgreSQL, LDAPS i certyfikat, odczyt grup MySQL FIS oraz oba routery. Nie kopiuj haseł do dokumentacji.', 'Wykonaj pnpm build:docker i pnpm build. Upewnij się, że BACKEND_IMAGE wskazuje zbudowany obraz i istnieją pliki bind mountów.', 'Uruchom docker compose up -d. Sprawdź zakończenie db-migrations i działanie backendu, Nginx, workera oraz reconciler.', 'Otwórz frontend na porcie 8082, zweryfikuj logowanie i /documentation. Port 4000 służy wyłącznie /fis/*.'], ['Prepare Node.js 24, the packageManager pnpm version (11.25.0), Encore CLI, Docker and Docker Compose.', 'Run pnpm install in the repository. Copy .env.example to .env and fill in your environment values.', 'Configure PostgreSQL, LDAPS and its certificate, FIS MySQL group reads and both routers. Do not copy passwords into documentation.', 'Run pnpm build:docker and pnpm build. Ensure BACKEND_IMAGE references the built image and bind-mounted files exist.', 'Run docker compose up -d. Check that db-migrations completed and backend, Nginx, worker and reconciler are running.', 'Open the frontend on port 8082 and verify login and /documentation. Port 4000 serves only /fis/*.']),
            code('# From repository root\npnpm install\n# Copy .env.example to .env and configure it first.\npnpm build:docker\npnpm build\ndocker compose up -d\n\n# Development\npnpm dev\n# UI: http://localhost:3000   API: http://localhost:4000\n\n# Documentation only\npnpm docs:build\npnpm docs:check'),
            table(pair(['Grupa ustawień', 'Zmienne'], ['Setting group', 'Variables']), pair([
                ['Host i obrazy', 'PALETKI_HOST_DIR, BACKEND_IMAGE, POSTGRES_PASSWORD, ENCORE_ENV'], ['LDAP', 'LDAP_URL, LDAP_LOGIN_DOMAIN, LDAP_SEARCH_BASE, LDAP_CA_CERT_PATH; konto lookup i sekrety'], ['Grupy FIS', 'FIS_DB_HOST/PORT/USER/PASSWORD, FIS_UR_GROUP, FIS_ME_GROUP'], ['Routery i kolejka', 'FIS1_ROUTER_URL, FIS2_ROUTER_URL, FIS_REQUEST_TIMEOUT_MS, FIS_OUTBOX_COMPLETED_RETENTION_DAYS'], ['Frontend i porty', 'VITE_DEV_API_BASE_URL, VITE_PROD_API_BASE_URL, FRONTEND_HTTP_PORT, FIS_INGRESS_PORT'],
            ], [
                ['Host and images', 'PALETKI_HOST_DIR, BACKEND_IMAGE, POSTGRES_PASSWORD, ENCORE_ENV'], ['LDAP', 'LDAP_URL, LDAP_LOGIN_DOMAIN, LDAP_SEARCH_BASE, LDAP_CA_CERT_PATH; lookup account and secrets'], ['FIS groups', 'FIS_DB_HOST/PORT/USER/PASSWORD, FIS_UR_GROUP, FIS_ME_GROUP'], ['Routers and queue', 'FIS1_ROUTER_URL, FIS2_ROUTER_URL, FIS_REQUEST_TIMEOUT_MS, FIS_OUTBOX_COMPLETED_RETENTION_DAYS'], ['Frontend and ports', 'VITE_DEV_API_BASE_URL, VITE_PROD_API_BASE_URL, FRONTEND_HTTP_PORT, FIS_INGRESS_PORT'],
            ])),
            paragraph('Portainer Web editor/Upload nie ładuje automatycznie pliku .env z hosta. Dodaj zmienne w konfiguracji stacka; PALETKI_HOST_DIR musi być absolutną ścieżką checkoutu na hoście Docker, np. /opt/paletki. Migracje, certyfikat, frontend/dist i nginx.conf muszą istnieć przed startem.', 'Portainer Web editor/Upload does not automatically load the host’s .env. Add variables in the stack configuration; PALETKI_HOST_DIR must be an absolute checkout path on the Docker host, e.g. /opt/paletki. Migrations, certificate, frontend/dist and nginx.conf must exist before startup.'),
            note('Wariant Encore lutowania wymaga osobnego wdrożenia integracji na serwerze FIS. Repozytorium zawiera JavaScript, ale nie dostarcza implementacji soldering-encore.php ani zewnętrznego JSModules.js. Sam build Paletek nie aktualizuje strony CGI.', 'The Encore soldering variant requires separate integration deployment on the FIS server. This repository contains the JavaScript but not the implementation of soldering-encore.php or external JSModules.js. Building Paletki alone does not update the CGI page.'),
        ],
    },
    {
        id: 'operations', group: 'technical', title: pair('Diagnostyka i utrzymanie', 'Diagnostics and operations'),
        description: pair('Odczyt stanu usług, kolejek i kopie danych.', 'Inspect service state and queues, and protect stored data.'),
        blocks: [
            steps(['Sprawdź docker compose ps i logi usługi powiązanej z problemem: backend, db-migrations, frontend albo worker.', 'Przy problemie logowania sprawdź łączność LDAPS, certyfikat CA i MySQL grup FIS. Limit Nginx logowania może zwrócić HTTP 429.', 'Przy rozjechanej ewidencji sprawdź kolejkę fis_outbox, docelowy router oraz jego odpowiedź; rozróżnij oczekiwanie od dead.', 'Przy brakującym cyklu porównaj rekord procesu FIS i liczniki. Endpoint cyklu nie daje bezpiecznego automatycznego odtworzenia żądania.', 'Przed zmianą wdrożenia wykonaj kopię bazy i przetestuj odtworzenie w osobnym środowisku. Zachowaj poprzedni obraz i bundle.'], ['Check docker compose ps and logs for the relevant service: backend, db-migrations, frontend or worker.', 'For login issues inspect LDAPS connectivity, CA certificate and FIS group MySQL. Nginx login throttling can return HTTP 429.', 'For inventory drift inspect fis_outbox, target router and its response; distinguish pending work from dead jobs.', 'For a missing cycle compare the FIS process record and counters. The cycle endpoint does not provide safe automatic request replay.', 'Before deployment changes back up the database and test restoration in a separate environment. Keep the previous image and bundle.']),
            code('docker compose ps\ndocker compose logs --tail=100 backend\ndocker compose logs --tail=100 db-migrations\ndocker compose logs --tail=100 fis-outbox-worker\n\n-- Read-only queue summary (PostgreSQL)\nSELECT status, COUNT(*) FROM fis_outbox GROUP BY status;'),
            note('Przykłady diagnostyczne nie wykonują napraw. Nie zmieniaj ręcznie liczników ani kolejki bez ustalenia stanu procesu. Powrót do poprzedniego obrazu nie cofa migracji bazy.', 'Diagnostic examples do not perform repairs. Do not manually modify counters or queues before establishing process state. Rolling back an image does not roll back database migrations.'),
        ],
    },
];

export function getDocumentation(language: DocLanguage): DocSection[] {
    return source.map(section => ({
        id: section.id, group: section.group, title: section.title[language], description: section.description[language],
        blocks: section.blocks.map(block => block[language]),
        ...(section.link ? {link: {...section.link, label: section.link.label[language]}} : {}),
    }));
}

// These pure functions are embedded in the standalone HTML as well.
export function normalizeDocumentationText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();
}
export function documentationText(section: DocSection): string {
    return [section.title, section.description, ...section.blocks.map(block => {
        if ('text' in block) return block.text;
        if ('items' in block) return block.items.join(' ');
        return [...block.headers, ...block.rows.flat()].join(' ');
    })].join(' ');
}
export function searchDocumentation(sections: DocSection[], query: string): DocSection[] {
    const words = normalizeDocumentationText(query).trim().split(/\s+/).filter(Boolean);
    return sections.filter(section => {
        const haystack = normalizeDocumentationText(documentationText(section));
        return words.every(word => haystack.includes(word));
    });
}
export function canOpenDocumentationLink(access: DocLinkAccess, user: DocumentationAccess): boolean {
    switch (access) {
        case 'manage': return user.canManagePallets;
        case 'maintenance': return user.canAccessMaintenance;
        case 'operator': return !user.isMaintenanceOnly;
        case 'it': return user.hasITDepartmentAccess;
        case 'all': return true;
    }
}
