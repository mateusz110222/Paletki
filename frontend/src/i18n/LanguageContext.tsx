import React, {createContext, ReactNode, use, useState} from 'react';

export type Language = 'pl' | 'en';

export const dictionaries = {
    pl: {
        // App & Nav
        nav_admin: 'Baza i Audyt (Admin)',
        nav_operator: 'Skaner (Operator)',
        nav_maintenance: 'Utrzymanie Ruchu (UR)',
        nav_live: 'Monitor Live (Dashboard)',

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

        // Modals
        modal_add_pallet_title: 'Dodaj Nową Paletę do Bazy',
        modal_add_project_title: 'Dodaj Nowy Projekt do Bazy',
        label_pallet_id: 'Pallet ID (pallet_id) *',
        label_project: 'Projekt przypisany *',
        label_model: 'Model *',
        label_max_cycles: 'Limit Cykli *',
        label_nests: 'Gniazda (Nests)',
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
        op_other_fault_type: '+ Inny rodzaj usterki',
        op_describe_fault: 'Opisz usterkę',
        op_fault_description_placeholder: 'Np. Pęknięta rama boczna przy pinu pozycjonującym...',
        op_report_damage: 'Zgłoś Uszkodzenie',
        op_project_model: 'Model',
        op_work_cycles: 'Cykle Pracy (Zużycie)',

        // Operator - komunikaty skanera
        op_scan_success: 'Paleta zeskanowana poprawnie.',
        op_scan_error: 'Błąd skanowania palety. Nie znaleziono palety o podanym ID.',
        op_no_pallet_scanned: 'Najpierw zeskanuj paletę.',
        op_fault_reported: 'Zgłoszenie usterki zostało zarejestrowane.',

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
        required_service_activities: 'Wymagane Czynności Serwisowe',
        ultrasonic_washing: 'Mycie ultradźwiękowe',
        remove_contaminants: 'Usunięcie zanieczyszczeń z gniazd i ramy',
        flux_residue_inspection: 'Inspekcja pozostałości topnika',
        verify_pin_cleanliness: 'Weryfikacja czystości pinów pozycjonujących',
        detailed_work_description: 'Szczegółowy Opis Prac',
        service_description_placeholder: 'Opisz wykonane naprawy lub powód odrzucenia/akceptacji serwisu...',
        approve_service_and_return: 'Zatwierdź Serwis i Przywróć do Pracy',
        maint_modal_error_confirm_tasks: 'Potwierdź wykonanie co najmniej jednej czynności serwisowej.',
        maint_modal_error_description_required: 'Opis wykonanych prac jest wymagany.',


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
        delete_pallet_confirm: 'Czy na pewno usunąć tę paletę?',
        audit_trail_title: 'Historia palety',
        placeholder_pallet_id: 'Wprowadź ID palety...',
        placeholder_model: "Wprowadz Model pallety...",
        placeholder_select_project: 'Wybierz projekt...',
        validation_required_fields: 'Proszę wypełnić wszystkie wymagane pola.',
        placeholder_project_name: 'Wprowadź nazwę projektu...',
        database_error: 'Błąd zapisu w bazie danych.',
        error_connecting_to_encore: 'Błąd połączenia z serwerem Encore.',
        no_history_entries: 'Brak wpisów w historii.',
        block_reason_required: "Proszę podać przyczynę blokady",
        failed_to_fetch_history: "Nie udało się pobrać historii dla tej palety.",
        confirm_unblock_message: "Czy na pewno chcesz odblokować paletkę?",

        // Auth & User
        login_title: 'System Obiegu Palet Lutowniczych',
        login_subtitle: 'Uwierzytelnianie Active Directory (BorgWarner LDAP)',
        login_username_label: 'Identyfikator AD / Email / sAMAccountName',
        login_username_placeholder: 'np. jkowalski lub domain\\jkowalski',
        login_password_label: 'Hasło Active Directory',
        login_password_placeholder: '••••••••••••',
        login_button: 'Zaloguj do Systemu',
        login_guest_button: 'Wejdź jako Gość',
        login_authenticating: 'Uwierzytelnianie w LDAP...',
        login_or_divider: 'LUB',
        login_error_title: 'Błąd logowania',
        auth_error: 'Wystąpił błąd podczas logowania.',
        logout_button: 'Wyloguj',
        guest_name: 'Gość',
        guest_department: 'Dostęp Ograniczony',

        // Global Error Modal
        global_error_title: 'Wystąpił Błąd',
        global_error_message_default: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.',
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
        // App & Nav
        nav_admin: 'Database & Audit (Admin)',
        nav_operator: 'Scanner (Operator)',
        nav_maintenance: 'Maintenance (UR)',
        nav_live: 'Live Monitor (Dashboard)',

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

        // Modals
        modal_add_pallet_title: 'Add New Pallet to Database',
        modal_add_project_title: 'Add New Project to Database',
        label_pallet_id: 'Pallet ID (pallet_id) *',
        label_project: 'Assigned Project *',
        label_model: 'Model *',
        label_max_cycles: 'Cycle Limit *',
        label_nests: 'Nests',
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
        op_other_fault_type: '+ Other fault type',
        op_describe_fault: 'Describe fault',
        op_fault_description_placeholder: 'E.g., Cracked side frame near positioning pin...',
        op_report_damage: 'Report Damage',
        op_project_model: 'Model',
        op_work_cycles: 'Work Cycles (Wear)',

        // Operator - scanner messages
        op_scan_success: 'Pallet scanned successfully.',
        op_scan_error: 'Pallet scan error. No pallet found with the given ID.',
        op_no_pallet_scanned: 'Scan a pallet first.',
        op_fault_reported: 'Fault report has been registered.',

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
        required_service_activities: 'Required Service Activities',
        ultrasonic_washing: 'Ultrasonic washing',
        remove_contaminants: 'Removal of contaminants from nests and frame',
        flux_residue_inspection: 'Flux residue inspection',
        verify_pin_cleanliness: 'Verification of positioning pin cleanliness',
        detailed_work_description: 'Detailed Work Description',
        service_description_placeholder: 'Describe performed repairs or reason for rejecting/accepting service...',
        approve_service_and_return: 'Approve Service and Return to Production',
        maint_modal_error_confirm_tasks: 'Confirm at least one service activity.',
        maint_modal_error_description_required: 'Description of performed work is required.',

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
        delete_pallet_confirm: 'Are you sure you want to delete this pallet?',
        audit_trail_title: 'Pallet History',
        placeholder_pallet_id: 'Enter pallet ID...',
        placeholder_model: "Enter pallet model...",
        placeholder_select_project: 'Select project...',
        validation_required_fields: 'Please fill in all required fields.',
        placeholder_project_name: 'Enter project name...',
        database_error: 'Database write error.',
        error_connecting_to_encore: 'Error connecting to Encore server.',
        no_history_entries: 'No history entries.',
        block_reason_required: "Please provide a block reason",
        failed_to_fetch_history: "Failed to fetch history for this pallet.",
        confirm_unblock_message: "Are you sure you want to unblock the pallet?",

        // Auth & User
        login_title: 'Soldering Pallet Circulation System',
        login_subtitle: 'Active Directory Authentication (BorgWarner LDAP)',
        login_username_label: 'AD Identifier / Email / sAMAccountName',
        login_username_placeholder: 'e.g. jkowalski or domain\\jkowalski',
        login_password_label: 'Active Directory Password',
        login_password_placeholder: '••••••••••••',
        login_button: 'Log In to System',
        login_guest_button: 'Continue as Guest',
        login_authenticating: 'Authenticating via LDAP...',
        login_or_divider: 'OR',
        login_error_title: 'Login Error',
        auth_error: 'An error occurred during login.',
        logout_button: 'Log Out',
        guest_name: 'Guest',
        guest_department: 'Limited Access',

        // Global Error Modal
        global_error_title: 'Error Occurred',
        global_error_message_default: 'An unexpected error occurred. Please try again later.',
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
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({children}) => {
    const [language, setLanguage] = useState<Language>('pl');

    const t = (key: TranslationKey): string => {
        return dictionaries[language][key] || dictionaries['pl'][key] || key;
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
    const {language, setLanguage} = useTranslation();

    return (
        <div
            className="flex items-center bg-brand-surface border border-brand-border rounded-lg p-1 text-xs font-bold font-mono">
            <button
                onClick={() => setLanguage('pl')}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${language === 'pl'
                    ? 'bg-brand-accent text-brand-bg font-extrabold shadow'
                    : 'text-brand-text-muted hover:text-brand-text'
                }`}
            >
                <span>🇵🇱</span> PL
            </button>
            <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${language === 'en'
                    ? 'bg-brand-accent text-brand-bg font-extrabold shadow'
                    : 'text-brand-text-muted hover:text-brand-text'
                }`}
            >
                <span>🇬🇧</span> EN
            </button>
        </div>
    );
};