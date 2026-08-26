import React, {createContext, ReactNode, use, useState} from 'react';

export type Language = 'pl' | 'en';

export const dictionaries = {
    pl: {
        nav_directory: 'Katalog LDAP (IT)',
        directory_title: 'Katalog użytkowników LDAP',
        directory_subtitle: 'Sprawdź departament, grupy AD i dostęp do PalletX na podstawie NetID.',
        directory_netid: 'NetID użytkownika',
        directory_search: 'Sprawdź użytkownika',
        directory_searching: 'Wyszukiwanie…',
        directory_hint: 'Wpisz sam NetID, bez domeny, np. matzielinski.',
        directory_empty: 'Znajdź użytkownika w katalogu firmowym',
        directory_empty_hint: 'Wynik pokaże departament i bezpośrednie członkostwo w grupach AD. Wyszukiwanie nie zmienia danych ani uprawnień.',
        directory_department: 'Departament LDAP',
        directory_job_title: 'Stanowisko',
        directory_access: 'Dostęp w PalletX',
        directory_it: 'IT · wszystkie widoki',
        directory_me: 'ME · wszystkie widoki poza katalogiem LDAP',
        directory_ur: 'UR · tylko utrzymanie ruchu',
        directory_operator: 'Operator · skaner i monitor',
        directory_access_hint: 'Dostęp wynika z departamentu, nie z grup AD. Pierwszeństwo: IT → ME → UR. Katalog LDAP jest tylko dla IT.',
        directory_groups: 'Bezpośrednie grupy AD',
        directory_groups_hint: 'Atrybut memberOf: bez grup zagnieżdżonych i grupy podstawowej użytkownika.',
        directory_no_groups: 'LDAP nie zwrócił żadnych bezpośrednich grup.',
        directory_partial: 'Serwer zwrócił ograniczoną listę grup — poniższe wyniki nie są kompletne.',
        directory_missing: 'Nie podano w LDAP',
        directory_error: 'Nie udało się pobrać użytkownika. Spróbuj ponownie.',
        directory_read_only: 'Tylko odczyt · dostęp IT',
        // App & Nav
        nav_admin: 'Baza i Audyt (Admin)',
        nav_operator: 'Skaner (Operator)',
        nav_maintenance: 'Utrzymanie Ruchu (UR)',
        nav_live: 'Monitor Live (Dashboard)',
        app_name: 'PALLETX',
        app_product_name: 'PALLETX',
        app_meta_description: 'System ewidencji, obiegu i historii paletek lutowniczych.',
        language_polish: 'Polski',
        language_english: 'Angielski',

        // Titles
        panel_admin_title: 'Panel Zarządzania (Baza i Audyt)',
        panel_admin_subtitle: 'Ewidencja, audit trail i blokowanie palet.',
        panel_operator_title: 'Skanowanie i Frontline',
        panel_operator_subtitle: 'Szybkie skanowanie, raportowanie usterek, frontline produkcyjny.',
        panel_maint_title: 'Utrzymanie Ruchu (Serwis i Mycie)',
        panel_maint_subtitle: 'Kolejka To-Do, logi serwisowe, mycie ultradźwiękowe i przywracanie.',
        panel_live_title: 'Monitor Produkcyjny (Live Broadcast)',
        panel_live_subtitle: 'Ekran telewizyjny na hali, dostępność projektów i ostrzeżenia cykli.',

        // Common Buttons
        btn_add_pallet: 'Dodaj Nową Paletę',
        btn_add_project: 'Dodaj Nowy Projekt',
        btn_export_audit: 'Eksportuj Audit Trail',
        btn_refresh_pallets: 'Odśwież Palety',
        btn_cancel: 'Anuluj',
        btn_save: 'Zapisz w Bazie',
        btn_saving: 'Zapisywanie w bazie...',
        btn_block: 'Zablokuj',
        block_reason: 'Powód Zablokowania',
        btn_unblock: 'Odblokuj',
        btn_delete: 'Usuń z ewidencji',
        btn_search_placeholder: 'Szukaj ID palety, projektu, pracownika...',
        btn_close: 'Zamknij',
        btn_scan: 'Skanuj',

        // Statuses
        status_all: 'Wszystkie Statusy',
        status_change: 'Zmiana Statusu:',
        status_on_modification: "Status podczas modyfikacji:",
        // Individual pallet statuses
        status_active: 'Aktywna',
        status_washing_required: 'Wymagane mycie',
        status_damaged: 'Uszkodzona',
        status_blocked: 'Zablokowana',
        // Table pagination
        rows_per_page: 'Wiersze na stronę',

        // Admin Panel
        stats_available_pallets: 'Dostępne Palety',
        stats_service_blocked: 'Serwis / Zablokowane',
        pallet_inventory_title: 'Ewidencja i Obieg Palet',
        col_pallet_id: 'Pallet ID',
        col_project: 'Projekt',
        col_model: 'Model',
        col_fis: 'Parametry (FIS)',
        col_cycles: 'Zużycie (Cykle)',
        col_total_cycles: "CYKLE CAŁKOWITE",
        col_status: 'Status',
        col_operator: 'Utworzył / Operator',
        col_actions: 'Akcje',
        no_pallets_found: 'Brak palet spełniających wybrane kryteria wyszukiwania.',
        saving: 'Zapisywanie',
        value_not_available: 'Brak danych',
        cycles_unit: 'cykli',
        audit_operator_label: 'Operator',
        audit_log_id_label: 'ID logu',
        fis_unit_history_link_label: 'Otwórz historię paletki {{palletId}} w FIS {{fis}}',
        maintenance_abbreviation: 'UR',
        availability_ok_suffix: 'OK',

        // Modals
        modal_add_pallet_title: 'Dodaj Nową Paletę do Bazy',
        modal_add_project_title: 'Dodaj Nowy Projekt do Bazy',
        label_pallet_id: 'Pallet ID (pallet_id) *',
        label_project: 'Projekt przypisany *',
        label_model: 'Model *',
        label_max_cycles: 'Limit Cykli *',
        label_nests: 'Gniazda (Nests)',
        label_fis: 'FIS *',
        label_block_reason: 'Przyczyna Zablokowania (block_reason) *',
        label_project_name: 'Nazwa Projektu *',

        // Operator Panel
        op_scanner_title: 'Skaner Palet',
        op_scanner_subtitle: 'Zeskanuj paletę, aby rozpocząć operacje.',
        op_scan_placeholder: 'ZESKANUJ KOD...',
        op_waiting_for_scanner: 'Oczekiwanie na sygnał skanera',
        op_technical_data: 'Dane techniczne',
        op_report_fault: 'Zgłoś Uszkodzenie',
        op_mechanical_damage: 'Uszkodzenie mechaniczne',
        op_washing_required: 'Wymagane mycie',
        op_pockets_error: 'Błąd gniazd (Pockets)',
        op_other_fault_type: 'Inny rodzaj usterki',
        op_describe_fault: 'Opisz usterkę',
        op_fault_description_placeholder: 'Np. Pęknięta rama boczna przy pinu pozycjonującym...',
        op_report_damage: 'Zgłoś Uszkodzenie',
        op_project_model: 'Model',
        op_work_cycles: 'Cykle Pracy (Zużycie)',

        // Operator - komunikaty skanera
        op_no_pallet_scanned: 'Najpierw zeskanuj paletę.',
        op_scan_success_with_id: 'Paleta {{palletId}} została zeskanowana poprawnie.',
        op_fault_reported_with_name: 'Zarejestrowano usterkę: {{faultName}}.',
        op_fault_audit_description: 'Zgłoszono usterkę (skaner): {{faultName}}',

        // Maintenance Panel
        maintenance_queue: 'Kolejka Serwisowa',
        pallets_count: 'PALETKI',
        priority_high: 'Priorytet: WYSOKI',
        for_repair: 'Do Naprawy',
        intervention_required_line1: 'Wymagana',
        intervention_required_line2: 'Interwencja',
        reported_damage: 'Zgłoszone uszkodzenia',
        routine_inspections: 'Przeglądy Okresowe',
        awaiting_service_line1: 'Oczekuje',
        awaiting_service_line2: 'na Serwis',
        cycle_limit_exceeded: 'Limit cykli przekroczony',
        technician_status: 'Status Technika',
        online_active: 'ONLINE • AKTYWNY',
        service_permissions_ok: 'Uprawnienia serwisowe OK',
        repairs_tab: 'Naprawy (Zgłoszenia)',
        routine_tab: 'Przeglądy (Routine)',
        damaged_status: 'USZKODZONA',
        cyclic_service: 'SERWIS CYKLICZNY',
        project_model: 'Projekt / Model',
        mileage: 'Przebieg',
        reason_for_reporting: 'Powód Zgłoszenia',
        start_servicing: 'Rozpocznij Serwisowanie',
        queue_empty: 'Kolejka pusta!',
        all_pallets_ok: 'Wszystkie palety w tej kategorii są obecnie sprawne.',
        service_protocol: 'Protokół Serwisowy',
        pallet_id_label: 'Paletka',
        approve_service_and_return: 'Zatwierdź Serwis i Przywróć do Pracy',
        maint_comment: 'Komentarz',
        maint_routine_comment_placeholder: 'Opisz wykonany serwis lub wykryte uszkodzenie...',
        maint_repair_comment_placeholder: 'Opisz wykonaną naprawę...',
        maint_modal_error_comment_required: 'Komentarz jest wymagany.',


        // Live Monitor
        project_health_monitor: 'Monitor Stanu Projektów',
        active_projects: "aktywnych projektów",
        next_refresh: "NASTĘPNE ODŚWIEŻENIE",
        no_registered_projects: "Brak zarejestrowanych projektów w paletach.",
        project: "PROJEKT",
        ready_total: "GOTOWE / RAZEM",
        unavailable_pallets: "NIEDOSTĘPNE",

        // Walidacja
        validation_error_pallet_id: 'Podaj ID palety.',
        pallet_exists: 'Paleta o takim ID już istnieje w bazie.',
        project_required: 'Wybierz projekt.',
        fis_invalid: 'Podaj poprawną wartość FIS.',
        project_name_empty: 'Podaj nazwę projektu.',

        filter_by_project: 'Filtruj wg Projektu',
        filter_by_model: 'Filtruj wg Modelu',
        filter_by_status: 'Filtruj wg Statusu',
        all_projects: 'Wszystkie Projekty',
        all_models: "Wszystkie Modele",
        all_statuses: 'Wszystkie Statusy',
        showing: 'Wyświetlono',
        of: 'z',
        registered_pallets: 'zarejestrowanych palet',
        modal_delete_pallet_title: 'Usuń paletkę',
        delete_pallet_confirm: 'Czy na pewno usunąć paletkę {{palletId}}?',
        delete_pallet_warning: 'Tej operacji nie można cofnąć. Paletka zostanie również usunięta z przypisanego FIS.',
        deleting_pallet: 'Usuwanie paletki...',
        audit_trail_title: 'Historia palety',
        history_page_title: 'Historia paletki',
        history_page_subtitle: 'Pełny audit trail, zmiany statusu i aktywność operatorów.',
        history_back_to_admin: 'Wróć do bazy paletek',
        history_loading: 'Ładowanie historii paletki',
        history_load_error: 'Nie udało się załadować historii paletki.',
        history_fis_link_available: 'Historia dostępna',
        history_entries: 'Wpisy historii',
        history_events: 'zdarzeń',
        history_operators: 'Operatorzy',
        history_search_placeholder: 'Szukaj w opisie, operatorze, statusie lub ID logu...',
        history_event_filter: 'Filtr rodzaju zdarzenia',
        history_status_filter: 'Filtr statusu paletki',
        history_all_events: 'Wszystkie zdarzenia',
        history_status_changes: 'Zmiany statusu',
        history_updates: 'Pozostałe aktualizacje',
        history_operator_filter: 'Filtr operatora',
        history_all_operators: 'Wszyscy operatorzy',
        history_sort_label: 'Sortowanie historii',
        history_sort_newest: 'Najnowsze najpierw',
        history_sort_oldest: 'Najstarsze najpierw',
        history_clear_filters: 'Wyczyść',
        history_showing_results: 'Wyświetlono {{shown}} z {{total}} pasujących wpisów',
        history_rows_per_page: 'Na stronie',
        history_no_results: 'Brak wpisów pasujących do wybranych filtrów.',
        history_pagination: 'Stronicowanie historii',
        history_previous_page: 'Poprzednia',
        history_next_page: 'Następna',
        history_page_of: 'Strona {{page}} z {{total}}',
        placeholder_pallet_id: 'Wprowadź ID palety...',
        placeholder_model: "Wprowadz Model pallety...",
        placeholder_select_project: 'Wybierz projekt...',
        validation_required_fields: 'Proszę wypełnić wszystkie wymagane pola.',
        placeholder_project_name: 'Wprowadź nazwę projektu...',
        error_connecting_to_encore: 'Błąd połączenia z serwerem Encore.',
        block_reason_required: "Proszę podać przyczynę blokady",
        confirm_unblock_message: "Czy na pewno chcesz odblokować paletkę?",

        // Auth & User
        login_title: 'System Obiegu Palet Lutowniczych',
        login_subtitle: 'Uwierzytelnianie Active Directory (BorgWarner LDAP)',
        login_username_label: 'Identyfikator AD / Email / sAMAccountName',
        login_username_placeholder: 'np. jkowalski lub domain\\jkowalski',
        login_password_label: 'Hasło Active Directory',
        login_password_placeholder: '••••••••••••',
        login_show_password: 'Pokaż hasło',
        login_hide_password: 'Ukryj hasło',
        login_button: 'Zaloguj do Systemu',
        login_operator_session_button: 'Operator lub stacja',
        login_back_to_ldap: 'Wróć do logowania LDAP',
        login_operator_session_title: 'Identyfikowalna sesja',
        login_operator_session_description: 'Podany identyfikator będzie widoczny w historii operacji wykonanych podczas tej sesji.',
        login_operator_identifier_label: 'NetID operatora lub nazwa stacji',
        login_operator_identifier_placeholder: 'np. matzielinski lub WAVESOLDER05',
        login_operator_identifier_examples: 'Dozwolone: litery, cyfry, kropka, myślnik i podkreślenie.',
        login_operator_identifier_required: 'Podaj NetID operatora lub nazwę stacji.',
        login_operator_session_start: 'Rozpocznij sesję operatora',
        login_operator_session_starting: 'Uruchamianie sesji...',
        login_authenticating: 'Uwierzytelnianie w LDAP...',
        login_or_divider: 'LUB',
        login_error_title: 'Błąd logowania',
        auth_error: 'Wystąpił błąd podczas logowania.',
        login_security_note: 'Zabezpieczono przez firmową usługę Active Directory BorgWarner',
        logout_button: 'Wyloguj',
        guest_department: 'Sesja operatorska',

        // Global Error Modal
        global_error_close_button: 'Zamknij',
        error_fetching_pallets_title: 'Błąd Pobierania Palet',
        error_fetching_projects_title: 'Błąd Pobierania Projektów',
        error_unblocking_pallet_title: 'Błąd Odblokowania Palety',
        error_deleting_pallet_title: 'Błąd Usuwania Palety',
        error_fetching_audit_history_title: 'Błąd Pobierania Historii Audytu',
        btn_edit: 'Edytuj',
        modal_edit_pallet_title: 'Edycja Danych Palety',
    },
    en: {
        nav_directory: 'LDAP Directory (IT)',
        directory_title: 'LDAP user directory',
        directory_subtitle: 'Look up departments, AD groups and PalletX access by NetID.',
        directory_netid: 'User NetID',
        directory_search: 'Look up user',
        directory_searching: 'Searching…',
        directory_hint: 'Enter only the NetID, without a domain, e.g. matzielinski.',
        directory_empty: 'Find a user in the corporate directory',
        directory_empty_hint: 'Results show the department and direct AD group membership. Lookup does not change data or permissions.',
        directory_department: 'LDAP department',
        directory_job_title: 'Job title',
        directory_access: 'PalletX access',
        directory_it: 'IT · all views',
        directory_me: 'ME · all views except the LDAP directory',
        directory_ur: 'Maintenance · maintenance only',
        directory_operator: 'Operator · scanner and monitor',
        directory_access_hint: 'Access is based on the department, not AD groups. Precedence: IT → ME → UR. The LDAP directory is IT-only.',
        directory_groups: 'Direct AD groups',
        directory_groups_hint: 'The memberOf attribute: excludes nested groups and the user’s primary group.',
        directory_no_groups: 'LDAP returned no direct groups.',
        directory_partial: 'The server returned a limited group list — the results below are incomplete.',
        directory_missing: 'Not specified in LDAP',
        directory_error: 'Could not look up the user. Please try again.',
        directory_read_only: 'Read only · IT access',
        // App & Nav
        nav_admin: 'Database & Audit (Admin)',
        nav_operator: 'Scanner (Operator)',
        nav_maintenance: 'Maintenance (UR)',
        nav_live: 'Live Monitor (Dashboard)',
        app_name: 'PALLETX',
        app_product_name: 'PALLETX',
        app_meta_description: 'Soldering pallet inventory, circulation, and history system.',
        language_polish: 'Polish',
        language_english: 'English',

        // Titles
        panel_admin_title: 'Management Panel (Database & Audit)',
        panel_admin_subtitle: 'Inventory, audit trail and pallet blocking.',
        panel_operator_title: 'Scanning & Frontline',
        panel_operator_subtitle: 'Quick scanning, fault reporting, production frontline.',
        panel_maint_title: 'Maintenance & Washing',
        panel_maint_subtitle: 'To-Do queue, service logs, ultrasonic washing and recovery.',
        panel_live_title: 'Production Monitor (Live Broadcast)',
        panel_live_subtitle: 'Shop floor display screen, project availability and cycle warnings.',

        // Common Buttons
        btn_add_pallet: 'Add New Pallet',
        btn_add_project: 'Add New Project',
        btn_export_audit: 'Export Audit Trail',
        btn_refresh_pallets: 'Refresh Pallets',
        btn_cancel: 'Cancel',
        btn_save: 'Save to Database',
        btn_saving: 'Saving to Database...',
        btn_block: 'Block',
        block_reason: 'Block Reason',
        btn_unblock: 'Unblock',
        btn_delete: 'Delete from inventory',
        btn_search_placeholder: 'Search pallet ID, project, employee...',
        btn_close: 'Close',
        btn_scan: 'Scan',

        // Statuses
        status_all: 'All Statuses',
        status_change: 'Status change:',
        status_on_modification: 'Status during modification:',
        // Individual pallet statuses
        status_active: 'Active',
        status_washing_required: 'Washing Required',
        status_damaged: 'Damaged',
        status_blocked: 'Blocked',
        // Table pagination
        rows_per_page: 'Rows per page',

        // Admin Panel
        stats_available_pallets: 'Available Pallets',
        stats_service_blocked: 'Service / Blocked',
        pallet_inventory_title: 'Inventory & Pallet Circulation',
        col_pallet_id: 'Pallet ID',
        col_project: 'Project',
        col_model: 'Model',
        col_fis: 'Parameters (FIS)',
        col_cycles: 'Usage (Cycles)',
        col_total_cycles: "TOTAL CYCLES",
        col_status: 'Status',
        col_operator: 'Created By / Operator',
        col_actions: 'Actions',
        no_pallets_found: 'No pallets matching the selected search criteria.',
        saving: 'saving',
        value_not_available: 'Not available',
        cycles_unit: 'cycles',
        audit_operator_label: 'Operator',
        audit_log_id_label: 'Log ID',
        fis_unit_history_link_label: 'Open pallet {{palletId}} history in FIS {{fis}}',
        maintenance_abbreviation: 'Maintenance',
        availability_ok_suffix: 'OK',

        // Modals
        modal_add_pallet_title: 'Add New Pallet to Database',
        modal_add_project_title: 'Add New Project to Database',
        label_pallet_id: 'Pallet ID (pallet_id) *',
        label_project: 'Assigned Project *',
        label_model: 'Model *',
        label_max_cycles: 'Cycle Limit *',
        label_nests: 'Nests',
        label_fis: 'FIS *',
        label_block_reason: 'Block Reason (block_reason) *',
        label_project_name: 'Project Name *',

        // Operator Panel
        op_scanner_title: 'Pallet Scanner',
        op_scanner_subtitle: 'Scan a pallet to begin operations.',
        op_scan_placeholder: 'SCAN CODE...',
        op_waiting_for_scanner: 'Waiting for scanner signal',
        op_technical_data: 'Technical Data',
        op_report_fault: 'Report Fault',
        op_mechanical_damage: 'Mechanical damage',
        op_washing_required: 'Washing required',
        op_pockets_error: 'Pockets error',
        op_other_fault_type: 'Other fault type',
        op_describe_fault: 'Describe fault',
        op_fault_description_placeholder: 'E.g., Cracked side frame near positioning pin...',
        op_report_damage: 'Report Damage',
        op_project_model: 'Model',
        op_work_cycles: 'Work Cycles (Wear)',

        // Operator - scanner messages
        op_no_pallet_scanned: 'Scan a pallet first.',
        op_scan_success_with_id: 'Pallet {{palletId}} was scanned successfully.',
        op_fault_reported_with_name: 'Fault registered: {{faultName}}.',
        op_fault_audit_description: 'Fault reported (scanner): {{faultName}}',

        // Maintenance Panel
        maintenance_queue: 'Service Queue',
        pallets_count: 'PALLETS',
        priority_high: 'Priority: HIGH',
        for_repair: 'For Repair',
        intervention_required_line1: 'Intervention',
        intervention_required_line2: 'Required',
        reported_damage: 'Reported damage',
        routine_inspections: 'Routine Inspections',
        awaiting_service_line1: 'Awaiting',
        awaiting_service_line2: 'Service',
        cycle_limit_exceeded: 'Cycle limit exceeded',
        technician_status: 'Technician Status',
        online_active: 'ONLINE • ACTIVE',
        service_permissions_ok: 'Service permissions OK',
        repairs_tab: 'Repairs (Reports)',
        routine_tab: 'Inspections (Routine)',
        damaged_status: 'DAMAGED',
        cyclic_service: 'CYCLIC SERVICE',
        project_model: 'Project / Model',
        mileage: 'Mileage',
        reason_for_reporting: 'Reason for Reporting',
        start_servicing: 'Start Servicing',
        queue_empty: 'Queue empty!',
        all_pallets_ok: 'All pallets in this category are currently functional.',
        service_protocol: 'Service Protocol',
        pallet_id_label: 'Pallet',
        approve_service_and_return: 'Approve Service and Return to Production',
        maint_comment: 'Comment',
        maint_routine_comment_placeholder: 'Describe the completed service or detected damage...',
        maint_repair_comment_placeholder: 'Describe the completed repair...',
        maint_modal_error_comment_required: 'Comment is required.',

        // Live Monitor & PubSub
        project_health_monitor: "PROJECT HEALTH MONITOR",
        active_projects: "active projects",
        next_refresh: "NEXT REFRESH",
        no_registered_projects: "No registered projects in pallets.",
        project: "PROJECT",
        ready_total: "READY / TOTAL",
        unavailable_pallets: "UNAVAILABLE",

        filter_by_project: "Filter by Project",
        filter_by_model: "Filter by Model",
        filter_by_status: "Filter by Status",
        all_projects: "All Projects",
        all_models: "All Models",
        all_statuses: "All Statuses",
        showing: "Showing",
        of: "of",
        registered_pallets: "registered pallets",

        // Validation
        validation_error_pallet_id: 'Please enter a Pallet ID.',
        pallet_exists: 'A pallet with this ID already exists in the database.',
        project_required: 'Please select a project.',
        fis_invalid: 'Please enter a valid FIS value.',
        project_name_empty: 'Please enter a project name.',
        modal_delete_pallet_title: 'Delete pallet',
        delete_pallet_confirm: 'Are you sure you want to delete pallet {{palletId}}?',
        delete_pallet_warning: 'This operation cannot be undone. The pallet will also be removed from its assigned FIS.',
        deleting_pallet: 'Deleting pallet...',
        audit_trail_title: 'Pallet History',
        history_page_title: 'Pallet History',
        history_page_subtitle: 'Complete audit trail, status changes, and operator activity.',
        history_back_to_admin: 'Back to pallet database',
        history_loading: 'Loading pallet history',
        history_load_error: 'Could not load pallet history.',
        history_fis_link_available: 'History available',
        history_entries: 'History entries',
        history_events: 'events',
        history_operators: 'Operators',
        history_search_placeholder: 'Search description, operator, status, or log ID...',
        history_event_filter: 'Event type filter',
        history_status_filter: 'Pallet status filter',
        history_all_events: 'All events',
        history_status_changes: 'Status changes',
        history_updates: 'Other updates',
        history_operator_filter: 'Operator filter',
        history_all_operators: 'All operators',
        history_sort_label: 'History sorting',
        history_sort_newest: 'Newest first',
        history_sort_oldest: 'Oldest first',
        history_clear_filters: 'Clear',
        history_showing_results: 'Showing {{shown}} of {{total}} matching entries',
        history_rows_per_page: 'Per page',
        history_no_results: 'No entries match the selected filters.',
        history_pagination: 'History pagination',
        history_previous_page: 'Previous',
        history_next_page: 'Next',
        history_page_of: 'Page {{page}} of {{total}}',
        placeholder_pallet_id: 'Enter pallet ID...',
        placeholder_model: "Enter pallet model...",
        placeholder_select_project: 'Select project...',
        validation_required_fields: 'Please fill in all required fields.',
        placeholder_project_name: 'Enter project name...',
        error_connecting_to_encore: 'Error connecting to Encore server.',
        block_reason_required: "Please provide a block reason",
        confirm_unblock_message: "Are you sure you want to unblock the pallet?",

        // Auth & User
        login_title: 'Soldering Pallet Circulation System',
        login_subtitle: 'Active Directory Authentication (BorgWarner LDAP)',
        login_username_label: 'AD Identifier / Email / sAMAccountName',
        login_username_placeholder: 'e.g. jkowalski or domain\\jkowalski',
        login_password_label: 'Active Directory Password',
        login_password_placeholder: '••••••••••••',
        login_show_password: 'Show password',
        login_hide_password: 'Hide password',
        login_button: 'Log In to System',
        login_operator_session_button: 'Operator or station',
        login_back_to_ldap: 'Back to LDAP login',
        login_operator_session_title: 'Identifiable session',
        login_operator_session_description: 'The identifier will be shown in the history of operations performed during this session.',
        login_operator_identifier_label: 'Operator NetID or station name',
        login_operator_identifier_placeholder: 'e.g. matzielinski or WAVESOLDER05',
        login_operator_identifier_examples: 'Allowed: letters, digits, dot, hyphen, and underscore.',
        login_operator_identifier_required: 'Enter the operator NetID or station name.',
        login_operator_session_start: 'Start operator session',
        login_operator_session_starting: 'Starting session...',
        login_authenticating: 'Authenticating via LDAP...',
        login_or_divider: 'OR',
        login_error_title: 'Login Error',
        auth_error: 'An error occurred during login.',
        login_security_note: 'Secured by BorgWarner Corporate Active Directory',
        logout_button: 'Log Out',
        guest_department: 'Operator session',

        // Global Error Modal
        global_error_close_button: 'Close',
        error_fetching_pallets_title: 'Error Fetching Pallets',
        error_fetching_projects_title: 'Error Fetching Projects',
        error_unblocking_pallet_title: 'Error Unblocking Pallet',
        error_deleting_pallet_title: 'Error Deleting Pallet',
        error_fetching_audit_history_title: 'Error Fetching Audit History',
        btn_edit: 'Edit',
        modal_edit_pallet_title: 'Edit Pallet Data',
    }
};

export type TranslationKey = keyof typeof dictionaries['pl'];

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({children}) => {
    const [language, setLanguage] = useState<Language>('pl');

    const t = (key: TranslationKey, variables: Record<string, string | number> = {}): string => {
        return Object.entries(variables).reduce(
            (translation, [name, value]) => translation.replaceAll(`{{${name}}}`, String(value)),
            dictionaries[language][key],
        );
    };

    return (
        <LanguageContext value={{language, setLanguage, t}}>
            {children}
        </LanguageContext>
    );
};

export const useTranslation = () => {
    const context = use(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};

export const LanguageSwitcher: React.FC = () => {
    const {language, setLanguage, t} = useTranslation();

    return (
        <div
            className="flex items-center bg-brand-surface border border-brand-border rounded-lg p-1 text-xs font-bold font-mono">
            <button
                onClick={() => setLanguage('pl')}
                title={t('language_polish')}
                aria-label={t('language_polish')}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${language === 'pl'
                    ? 'bg-brand-accent text-brand-bg font-extrabold shadow'
                    : 'text-brand-text-muted hover:text-brand-text'
                }`}
            >
                <span aria-hidden="true">🇵🇱</span> PL
            </button>
            <button
                onClick={() => setLanguage('en')}
                title={t('language_english')}
                aria-label={t('language_english')}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${language === 'en'
                    ? 'bg-brand-accent text-brand-bg font-extrabold shadow'
                    : 'text-brand-text-muted hover:text-brand-text'
                }`}
            >
                <span aria-hidden="true">🇬🇧</span> EN
            </button>
        </div>
    );
};
