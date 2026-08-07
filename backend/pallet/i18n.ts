export type SupportedLanguage = 'pl' | 'en';

export const defaultLanguage: SupportedLanguage = 'pl';

export const translations = {
  pl: {
    pallet_id_empty: "Kod palety (pallet_id) nie może być pusty.",
    pallet_exists: "Paleta o podanym ID już istnieje w bazie danych.",
    project_exists: "Projekt o takiej nazwie już istnieje w bazie danych.",
    project_required: "Wskazanie projektu jest wymagane.",
    fis_invalid: "Pole FIS nie może być puste ani równe 0.",
    operator_required: "Pole 'created_by' musi zawierać identyfikator użytkownika.",
    block_reason_required: "Dla podanego statusu palety wymagane jest podanie przyczyny.",
    new_status_required: "Status palety jest wymagany.",
    max_cycles_invalid: "Maksymalna liczba cykli musi być większa od 0.",
    nests_invalid: "Liczba gniazd (nests) musi być większa od 0.",
    project_name_empty: "Nazwa projektu nie może być pusta.",
    description_required: "Pole 'description' nie może być puste.",

    pallet_not_found: "Nie znaleziono palety o podanym identyfikatorze w bazie.",
    added_new_pallet: "Dodano nową paletę do bazy danych.",

    // Audit logs
    audit_registered: "Paleta została zarejestrowana w systemie.",
    audit_blocked: "Zablokowano paletę.",
    audit_unblocked: "Odblokowano paletę w panelu zarządczym.",
    audit_deleted: "Paleta została usunięta z bazy danych.",
    audit_cycle_limit: "Automatyczna zmiana statusu: Osiągnięto limit cykli zużycia.",
    audit_log_write_error: "Błąd zapisu logu audytowego.",
    audit_reset_cycles: "Reset cykli po myciu/serwisie. Wyczyszczono licznik cykli bieżących.",

    // Reset cycles
    reset_cycles_error: "Błąd podczas resetowania cykli palety.",

    // Auth
    login_password_required: "Login i hasło są wymagane.",
    auth_success: "Zalogowano pomyślnie.",
    auth_invalid_credentials: "Nieprawidłowy login lub hasło domain Active Directory.",
    auth_timeout: "Przekroczono czas oczekiwania na odpowiedź serwera LDAP (BorgWarner).",
    auth_error: "Błąd uwierzytelniania w sieci firmowej LDAP.",
  },
  en: {
    pallet_id_empty: "Pallet ID (pallet_id) cannot be empty.",
    pallet_exists: "A pallet with the specified ID already exists in the database.",
    project_exists: "Project with the same name already exists in the database.",
    project_required: "Selecting a project is required.",
    fis_invalid: "FIS field cannot be empty or equal to 0.",
    operator_required: "The 'created_by' field must contain a valid operator ID.",
    block_reason_required: "For the given pallet status, a block_reason is required.",
    new_status_required: "Pallet status is required.",
    max_cycles_invalid: "Max cycles must be greater than 0.",
    nests_invalid: "Number of nests must be greater than 0.",
    project_name_empty: "Project name cannot be empty.",
    description_required: "The 'description' field cannot be empty.",

    pallet_not_found: "Pallet with the specified ID was not found in the database.",
    added_new_pallet: "Added new pallet to the database.",

    // Audit logs
    audit_registered: "Pallet has been registered in the system.",
    audit_blocked: "Pallet has been blocked.",
    audit_unblocked: "Pallet has been unblocked in the admin panel.",
    audit_deleted: "Pallet has been deleted from the database.",
    audit_cycle_limit: "Automatic status change: Cycle wear limit reached.",
    audit_log_write_error: "Error writing audit log entry.",
    audit_reset_cycles: "Cycle reset after washing/service. Current cycle counter cleared.",

    // Reset cycles
    reset_cycles_error: "Error resetting pallet cycles.",

    // Auth
    login_password_required: "Login and password are required.",
    auth_success: "Login successful.",
    auth_invalid_credentials: "Invalid Active Directory username or password.",
    auth_timeout: "LDAP server timeout (BorgWarner domain).",
    auth_error: "Authentication error on corporate LDAP network.",
  }
};

export function parseLanguage(langHeader?: string | null): SupportedLanguage {
  if (!langHeader) return defaultLanguage;
  const normalized = langHeader.toLowerCase();
  if (normalized.includes('en')) return 'en';
  return 'pl';
}

export function t(key: keyof typeof translations['pl'], lang?: SupportedLanguage | string | null): string {
  const selectedLang = parseLanguage(lang);
  return translations[selectedLang][key] || translations['pl'][key] || key;
}
