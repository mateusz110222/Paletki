export type SupportedLanguage = "pl" | "en";

export const defaultLanguage: SupportedLanguage = "pl";

const pl = {
    pallet_id_empty: "Kod palety (pallet_id) nie może być pusty.",
    pallet_exists: "Paleta o podanym ID już istnieje w bazie danych.",
    project_exists: "Projekt o takiej nazwie już istnieje w bazie danych.",
    project_required: "Wskazanie projektu jest wymagane.",
    model_required: "Model palety jest wymagany.",
    fis_invalid: "Pole FIS musi być większe od 0.",
    operator_required: "Identyfikator operatora jest wymagany.",
    fis_unsupported: "Obsługiwane wartości FIS to 1 lub 2.",
    block_reason_required: "Dla podanego statusu palety wymagane jest podanie przyczyny.",
    new_status_required: "Status palety jest wymagany.",
    status_invalid: "Nieobsługiwany status palety: {{status}}.",
    max_cycles_invalid: "Maksymalna liczba cykli musi być większa od 0.",
    nests_invalid: "Liczba gniazd musi być większa od 0.",
    project_name_empty: "Nazwa projektu nie może być pusta.",
    pallet_not_found: "Nie znaleziono palety o podanym identyfikatorze w bazie.",
    pallet_deleted: "Paleta została usunięta.",
    database_error: "Operacja na bazie danych nie powiodła się.",
    fis_http_error: "Usługa FIS odrzuciła operację {{operation}} (HTTP {{status}}: {{statusText}}).",
    fis_connection_error: "Nie udało się połączyć z usługą FIS podczas operacji {{operation}}.",
    fis_operation_failed: "Operacja FIS {{operation}} nie powiodła się: {{message}}.",
    fis_invalid_response: "Usługa FIS zwróciła nieprawidłową odpowiedź dla operacji {{operation}}.",

    audit_registered: "Paleta została zarejestrowana w systemie.",
    audit_status_changed: "Zmieniono status palety.",
    audit_blocked: "Zablokowano paletę.",
    audit_unblocked: "Odblokowano paletę w panelu zarządczym.",
    audit_cycle_limit: "Automatyczna blokada: osiągnięto limit {{maxCycles}} cykli przed myciem.",
    audit_reset_cycles: "Wyzerowano licznik cykli po myciu lub serwisie.",
    audit_updated: "Zmieniono dane palety: {{changes}}.",
    audit_change_fis: "FIS {{from}} → {{to}}",
    audit_change_nests: "gniazda {{from}} → {{to}}",
    audit_change_max_cycles: "limit cykli {{from}} → {{to}}",
    audit_edited: "Edytowano dane palety.",
    system_operator: "System",
    system_auto_block_operator: "System – automatyczna blokada",

    login_password_required: "Login i hasło są wymagane.",
    auth_success: "Zalogowano pomyślnie.",
    auth_invalid_credentials: "Nieprawidłowy login lub hasło Active Directory.",
    auth_timeout: "Przekroczono czas oczekiwania na odpowiedź serwera LDAP.",
    auth_error: "Błąd uwierzytelniania w sieci firmowej LDAP.",
    auth_invalid_login_format: "Format loginu Active Directory jest nieprawidłowy.",
    auth_login_mixed_formats: "Login nie może jednocześnie używać formatów DOMENA\\login oraz login@domena.",
    auth_invalid_domain_login: "Login w formacie DOMENA\\login jest nieprawidłowy.",
    auth_invalid_upn: "Login w formacie login@domena jest nieprawidłowy.",
    auth_unavailable: "Serwer LDAP jest obecnie niedostępny.",
    auth_profile_not_found: "Nie znaleziono profilu zalogowanego użytkownika w LDAP.",
    auth_profile_ambiguous: "LDAP zwrócił więcej niż jeden profil użytkownika.",
    auth_profile_error: "Nie udało się jednoznacznie odczytać profilu użytkownika z LDAP.",
    auth_session_invalid: "Sesja wygasła lub token uwierzytelniający jest nieprawidłowy.",
    auth_guest_success: "Uruchomiono sesję operatora.",
    auth_logout_success: "Wylogowano pomyślnie.",
    auth_staff_required: "Ta operacja jest dostępna wyłącznie dla skonfigurowanych działów IT LDAP.",
} as const;

export type TranslationKey = keyof typeof pl;

const en: Record<TranslationKey, string> = {
    pallet_id_empty: "Pallet ID (pallet_id) cannot be empty.",
    pallet_exists: "A pallet with the specified ID already exists in the database.",
    project_exists: "A project with the same name already exists in the database.",
    project_required: "A project is required.",
    model_required: "A pallet model is required.",
    fis_invalid: "FIS must be greater than 0.",
    operator_required: "An operator identifier is required.",
    fis_unsupported: "Supported FIS values are 1 and 2.",
    block_reason_required: "A reason is required for the selected pallet status.",
    new_status_required: "Pallet status is required.",
    status_invalid: "Unsupported pallet status: {{status}}.",
    max_cycles_invalid: "Maximum cycles must be greater than 0.",
    nests_invalid: "The number of nests must be greater than 0.",
    project_name_empty: "Project name cannot be empty.",
    pallet_not_found: "Pallet with the specified ID was not found in the database.",
    pallet_deleted: "Pallet was deleted.",
    database_error: "The database operation failed.",
    fis_http_error: "The FIS service rejected operation {{operation}} (HTTP {{status}}: {{statusText}}).",
    fis_connection_error: "Could not connect to the FIS service during operation {{operation}}.",
    fis_operation_failed: "FIS operation {{operation}} failed: {{message}}.",
    fis_invalid_response: "The FIS service returned an invalid response for operation {{operation}}.",

    audit_registered: "Pallet was registered in the system.",
    audit_status_changed: "Pallet status was changed.",
    audit_blocked: "Pallet was blocked.",
    audit_unblocked: "Pallet was unblocked in the administration panel.",
    audit_cycle_limit: "Automatic block: the washing limit of {{maxCycles}} cycles was reached.",
    audit_reset_cycles: "The cycle counter was reset after washing or service.",
    audit_updated: "Pallet data changed: {{changes}}.",
    audit_change_fis: "FIS {{from}} → {{to}}",
    audit_change_nests: "nests {{from}} → {{to}}",
    audit_change_max_cycles: "cycle limit {{from}} → {{to}}",
    audit_edited: "Pallet data was edited.",
    system_operator: "System",
    system_auto_block_operator: "System – automatic block",

    login_password_required: "Login and password are required.",
    auth_success: "Login successful.",
    auth_invalid_credentials: "Invalid Active Directory username or password.",
    auth_timeout: "The LDAP server timed out.",
    auth_invalid_login_format: "The Active Directory login format is invalid.",
    auth_login_mixed_formats: "The login cannot combine DOMAIN\\login and login@domain formats.",
    auth_invalid_domain_login: "The DOMAIN\\login format is invalid.",
    auth_invalid_upn: "The login@domain format is invalid.",
    auth_unavailable: "The LDAP server is currently unavailable.",
    auth_profile_not_found: "The authenticated user's LDAP profile was not found.",
    auth_profile_ambiguous: "LDAP returned more than one user profile.",
    auth_profile_error: "The LDAP user profile could not be resolved unambiguously.",
    auth_error: "Authentication failed on the corporate LDAP network.",
    auth_session_invalid: "The session expired or the authentication token is invalid.",
    auth_guest_success: "The operator session was started.",
    auth_logout_success: "Logout successful.",
    auth_staff_required: "This operation is restricted to configured LDAP IT departments.",
};

export const translations = {pl, en} as const;

export function parseLanguage(langHeader?: string | null): SupportedLanguage {
    if (!langHeader) return defaultLanguage;

    const candidates = langHeader
        .split(",")
        .map((part) => {
            const [tag, ...parameters] = part.trim().toLowerCase().split(";");
            const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
            const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
            return {language: tag.split("-")[0], quality: Number.isFinite(quality) ? quality : 0};
        })
        .filter((candidate) => candidate.quality > 0)
        .sort((left, right) => right.quality - left.quality);

    const supported = candidates.find(
        (candidate): candidate is {language: SupportedLanguage; quality: number} =>
            candidate.language === "pl" || candidate.language === "en",
    );

    return supported?.language ?? defaultLanguage;
}

export function t(
    key: TranslationKey,
    lang?: SupportedLanguage | string | null,
    variables: Record<string, string | number> = {},
): string {
    return Object.entries(variables).reduce(
        (translation, [name, value]) => translation.replaceAll(`{{${name}}}`, String(value)),
        translations[parseLanguage(lang)][key],
    );
}
