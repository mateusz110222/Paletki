import {AppConfig, fetchJSON} from "../../matz/jsBB/JSModules.js";

let process;
let station;
let instruction_needed;
let configFile;
let palletSerialNumber;
let palletSerialNumberValue;
let unitSerialNumberValue;
let nests;
let sensorQuantity = 0;
let sensorPn = "";
let powerModuleToChild = "";
let goodFlag = 0;
let inputs = [];
let messageTimerId = null;
let palletCheckInProgress = false;
let unitCheckInProgress = false;
let processSaveInProgress = false;
const UI_COLORS = ["bg-red", "bg-[red]", "bg-[green]", "bg-teal-200", "bg-[orange]", "bg-teal-400",];
const ACTIVE_PALLET_STATUS = "Active";
const PALLET_STATUSES = new Set(["Active", "Washing_Required", "Damaged", "Blocked",]);
const FIS2_HOSTNAME = "plblofis2.global.borgwarner.net";
const PENDING_CYCLE_STORAGE_KEY = "paletki:soldering:pending-cycle:v1";
const ENCORE_TIMEOUT_MS = 12000;
const ENCORE_RETRIES = 2;
const STANDARD_INPUT_CLASSES = ["ml-2", "w-full", "text-center", "text-lg", "tracking-widest", "text-amber-700", "dark:text-yellow-300", "bg-gray-50", "dark:bg-black/40", "border-2", "border-amber-200", "dark:border-yellow-500/30", "rounded-xl", "p-1", "outline-none", "focus:border-amber-500", "dark:focus:border-yellow-400", "transition-all", "duration-200",];

function createCustomInput({
                               id,
                               name,
                               value = "",
                               placeholder = "",
                               required = false,
                               disabled = false,
                               autofocus = false,
                           }) {
    const input = document.createElement("input");
    input.type = "text";
    input.name = name || id;
    input.id = id;
    if (value) input.value = value;
    if (placeholder) input.placeholder = placeholder;
    input.autocomplete = "off";
    input.required = required;
    input.disabled = disabled;
    if (autofocus) input.autofocus = true;
    input.classList.add(...STANDARD_INPUT_CLASSES);
    input.style.textTransform = "uppercase";
    return input;
}

function createCustomLabel(forId, text) {
    const label = document.createElement("label");
    label.htmlFor = forId;
    label.textContent = text;
    label.classList.add("text-xl");
    return label;
}

function hasDuplicateValues(inputSelector) {
    const elInputs = document.querySelectorAll(inputSelector);
    const values = Array.from(elInputs)
        .map((input) => input.value.toUpperCase())
        .filter((val) => val !== "");
    return new Set(values).size !== values.length;
}

function hasDuplicateRootValue(currentInput, value) {
    const normalizedValue = String(value || "").trim().toUpperCase();
    if (!normalizedValue) return false;
    return Array.from(document.querySelectorAll('input[name="unitSerialNumber"]'))
        .some((input) => input !== currentInput && String(input.value || "").trim().toUpperCase() === normalizedValue);
}

const PHP_API_URL = "/custom/jj00sp/php/soldering-encore.php";
const PALETKI_API_URL = "//10.142.11.66:4000";
const ROUTER_ENDPOINT = AppConfig.api.phpBBRouter;

function classifyRouterFailure(payload, error = null) {
    const httpStatus = Number(error?.status ?? error?.response?.status ?? payload?.http_status ?? payload?.status_code,);
    const code = String(payload?.reason ?? payload?.code ?? payload?.error_code ?? "").toUpperCase();
    const message = String(payload?.message ?? error?.message ?? "");
    if ((Number.isFinite(httpStatus) && httpStatus >= 500) || /(TIMEOUT|NETWORK|CONNECTION|UNAVAILABLE|INTERNAL|DATABASE|DB_ERROR|TRANSPORT)/.test(code) || /(timeout|timed out|network error|connection (failed|refused)|database (connection|unavailable)|błąd połączenia z bazą|brak połączenia|router.*niedostęp)/i.test(message)) {
        return "transport";
    }
    return null;
}

async function routerCall(job, payload = {}) {
    try {
        const result = await fetchJSON(ROUTER_ENDPOINT, job, payload);
        if (!result || typeof result !== "object" || typeof result.status !== "boolean") {
            console.error(`routerCall(${job}) invalid response:`, result);
            return {
                status: false,
                message: "Router FIS zwrócił nieprawidłową odpowiedź",
                data: null,
                failure_kind: "transport",
            };
        }
        return {...result, failure_kind: result.status ? null : classifyRouterFailure(result)};
    } catch (e) {
        if (e.payload) {
            // Backend odpowiedział poprawnym JSON-em ze status:false
            return {
                ...(typeof e.payload === "object" ? e.payload : {}),
                status: false,
                message: e.payload.message ?? e.message ?? "",
                data: e.payload.data ?? null,
                failure_kind: classifyRouterFailure(e.payload, e),
            };
        }

        console.error(`routerCall(${job}) transport error:`, e);

        return {
            status: false, message: e.message || String(e), data: null, failure_kind: "transport",
        };
    }
}

class EncoreHttpError extends Error {
    constructor(response, body) {
        const serverMessage = typeof body === "string" ? body : body && typeof body === "object" ? body.message : "";
        super(serverMessage || `Encore API failed with status: ${response.status}`);
        this.name = "EncoreHttpError";
        this.status = response.status;
        this.body = body;
    }
}

function getEncoreErrorMessage(error, fallback) {
    if (!(error instanceof EncoreHttpError)) {
        return error?.message || fallback;
    }
    const details = error.body?.details;
    const messages = {
        PALLET_NOT_FOUND: "Paleta nie jest zarejestrowana w Encore",
        PALLET_NOT_ACTIVE: `Paleta nie jest aktywna${details?.pallet_status ? ` (${details.pallet_status})` : ""}`,
        CYCLE_LIMIT_REACHED: "Paleta osiągnęła limit cykli i wymaga mycia",
        CYCLE_EVENT_METADATA_CONFLICT: "Wykryto niespójny zapis oczekującego cyklu. Nie ponawiaj procesu i skontaktuj się z IT.",
        CYCLE_EVENT_NOT_FINALIZED: "Poprzedni zapis cyklu jest jeszcze przetwarzany. Spróbuj ponownie za chwilę.",
        INVALID_CYCLE_EVENT_ID: "Nieprawidłowy identyfikator zapisu cyklu",
        INVALID_PALLET_ID: "Nieprawidłowy numer palety",
        INVALID_STATION: "Nieprawidłowa konfiguracja nazwy stacji",
        INVALID_PROCESS: "Nieprawidłowa konfiguracja procesu",
        INVALID_UNIT_IDS: "Nieprawidłowa lista sztuk przypisana do cyklu",
    };
    return messages[details?.reason] || error.message || fallback;
}

async function apiCall(jobName, formData) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENCORE_TIMEOUT_MS);
    try {
        const response = await fetch(`${PHP_API_URL}?job=${jobName}`, {
            method: "POST", body: formData, signal: controller.signal,
        });
        const responseText = await response.text();
        let body = null;
        if (responseText) {
            try {
                body = JSON.parse(responseText);
            } catch {
                body = responseText;
            }
        }
        if (!response.ok) {
            const message = body && typeof body === "object" ? body.message : body;
            throw new Error(message || `API ${jobName} failed with status: ${response.status}`);
        }
        if (!body || typeof body !== "object" || typeof body.status !== "boolean") {
            throw new Error(`API ${jobName} zwróciło nieprawidłową odpowiedź`);
        }
        return body;
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new Error(`API ${jobName} nie odpowiedziało w ciągu ${ENCORE_TIMEOUT_MS / 1000} sekund`, {cause: error});
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableEncoreStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}

async function encoreCall(path, options = {}) {
    const {timeoutMs = ENCORE_TIMEOUT_MS, retries = ENCORE_RETRIES, ...fetchOptions} = options;
    const headers = {
        ...(fetchOptions.headers || {}),
    };
    const hasContentType = Object.keys(headers).some((name) => name.toLowerCase() === "content-type");
    if (fetchOptions.body != null && !(fetchOptions.body instanceof FormData) && !hasContentType) {
        headers["Content-Type"] = "application/json";
    }

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(`${PALETKI_API_URL}${path}`, {
                ...fetchOptions, headers, signal: controller.signal,
            });
            let body = null;
            if (response.status !== 204) {
                const responseText = await response.text();
                if (responseText) {
                    try {
                        body = JSON.parse(responseText);
                    } catch {
                        body = responseText;
                    }
                }
            }
            if (response.ok) {
                return body;
            }

            lastError = new EncoreHttpError(response, body);
            if (!isRetryableEncoreStatus(response.status) || attempt === retries) {
                throw lastError;
            }
        } catch (error) {
            lastError = error?.name === "AbortError" ? new Error(`Encore nie odpowiedziało w ciągu ${timeoutMs / 1000} sekund`) : error;
            if (error instanceof EncoreHttpError && !isRetryableEncoreStatus(error.status)) {
                throw error;
            }
            if (attempt === retries) {
                throw lastError;
            }
        } finally {
            clearTimeout(timeoutId);
        }
        await wait(250 * (attempt + 1));
    }
    throw lastError || new Error("Nieznany błąd komunikacji z Encore");
}

function requireFiniteNumber(value, fieldName) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        throw new Error(`Nieprawidłowe pole palety: ${fieldName}`);
    }
    return numberValue;
}

function normalizePallet(responseBody) {
    const candidate = responseBody?.data && !Array.isArray(responseBody.data) ? responseBody.data : responseBody;
    if (!candidate || typeof candidate !== "object") {
        throw new Error("Encore zwrócił nieprawidłowe dane palety");
    }
    const palletId = String(candidate.pallet_id || "")
        .trim()
        .toUpperCase();
    const status = candidate.status;
    if (!palletId) {
        throw new Error("Encore nie zwrócił numeru palety");
    }
    if (status !== null && !PALLET_STATUSES.has(status)) {
        throw new Error(`Nieznany status palety: ${String(status)}`);
    }
    const normalized = {
        ...candidate,
        pallet_id: palletId,
        max_cycles: requireFiniteNumber(candidate.max_cycles, "max_cycles"),
        current_cycles: requireFiniteNumber(candidate.current_cycles, "current_cycles"),
        total_cycles: requireFiniteNumber(candidate.total_cycles, "total_cycles"),
        nests: requireFiniteNumber(candidate.nests, "nests"),
        fis: candidate.fis == null ? null : requireFiniteNumber(candidate.fis, "fis"),
    };
    if (!Number.isInteger(normalized.nests) || normalized.nests < 1) {
        throw new Error("Nieprawidłowa liczba gniazd palety");
    }
    if (!Number.isInteger(normalized.max_cycles) || !Number.isInteger(normalized.current_cycles) || !Number.isInteger(normalized.total_cycles) || normalized.max_cycles <= 0 || normalized.current_cycles < 0 || normalized.total_cycles < 0) {
        throw new Error("Encore zwrócił nieprawidłowe wartości cykli palety");
    }
    if (normalized.fis !== 1 && normalized.fis !== 2) {
        throw new Error("Paleta nie ma przypisanego prawidłowego numeru FIS");
    }
    return normalized;
}

function palletIdFrom(fd) {
    return String(fd.get("palletSerialNumber") || "")
        .trim()
        .toUpperCase();
}

function getPalletFromEncore(fd) {
    const palletId = palletIdFrom(fd);
    if (!palletId) {
        return Promise.reject(new Error("Brak numeru palety"));
    }
    return encoreCall(`/fis/soldering/pallets/${encodeURIComponent(palletId)}`).then(normalizePallet);
}

const palletEntry = async (fd) => {
    const palletId = palletIdFrom(fd);
    if (!palletId) {
        return {
            status: false, message: "Brak numeru palety", data: null,
        };
    }
    let retrySafe = false;
    try {
        const unitIds = collectCycleUnitIds(fd);
        const {eventId, storageKey} = ensurePendingCycleEvent(palletId);
        updatePendingCycleEvent(storageKey, eventId, palletId, unitIds);
        retrySafe = true;
        const result = await registerCycleInEncore(palletId, eventId, unitIds);
        completePendingCycleEvent(storageKey, eventId);
        return {
            status: true,
            message: result.cycle_recorded ? "Cykl palety został zapisany" : "Cykl palety był już zapisany i nie został naliczony ponownie",
            data: result,
        };
    } catch (error) {
        const reason = error instanceof EncoreHttpError ? error.body?.details?.reason : null;
        const manualReviewReasons = new Set(["PALLET_NOT_FOUND", "PALLET_NOT_ACTIVE", "CYCLE_LIMIT_REACHED", "CYCLE_EVENT_METADATA_CONFLICT", "INVALID_CYCLE_EVENT_ID", "INVALID_PALLET_ID", "INVALID_STATION", "INVALID_PROCESS", "INVALID_UNIT_IDS",]);
        const definitiveClientError = error instanceof EncoreHttpError && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status) && reason !== "CYCLE_EVENT_NOT_FINALIZED";
        return {
            status: false,
            message: getEncoreErrorMessage(error, "Błąd zapisu cyklu palety"),
            data: null,
            retry_safe: retrySafe,
            automatic_reconcile: retrySafe && !manualReviewReasons.has(reason) && !definitiveClientError,
        };
    }
};

function collectCycleUnitIds(fd) {
    const values = [...Array.from(document.querySelectorAll('input[name="unitSerialNumber"], input[name="childSerialNumber"], input[name="powerModuleSn"], input[name="sensorSn"]',))
        .map((input) => input.value), ...["unit", "unitSerialNumber", "parent", "child", "powerModuleSn", "sensorSn"]
        .flatMap((name) => fd.getAll(name)),]
        .map((value) => String(value || "").trim().toUpperCase())
        .filter(Boolean);
    const uniqueValues = [...new Set(values)].sort();
    if (uniqueValues.length === 0) {
        throw new Error("Brak numeru sztuki potrzebnego do zapisania cyklu palety");
    }
    return uniqueValues;
}

function pendingCycleStorageKey(palletId) {
    const identity = [station, process, palletId]
        .map((value) => encodeURIComponent(String(value || "").trim().toUpperCase()))
        .join(":");
    return `${PENDING_CYCLE_STORAGE_KEY}:${identity}`;
}

function generateCycleEventId() {
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error("Przeglądarka nie obsługuje generatora identyfikatora cyklu");
    }
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readPendingCycleEvent(storageKey) {
    let storedValue;
    try {
        storedValue = localStorage.getItem(storageKey);
    } catch (error) {
        throw new Error("Nie można odczytać dziennika zapisu cyklu w przeglądarce", {cause: error});
    }
    if (!storedValue) return null;
    try {
        const record = JSON.parse(storedValue);
        return record && typeof record === "object" ? record : null;
    } catch (error) {
        console.warn("Uszkodzony wpis oczekującego cyklu zostanie zastąpiony:", error);
        return null;
    }
}

function ensurePendingCycleEvent(palletId) {
    const storageKey = pendingCycleStorageKey(palletId);
    const record = readPendingCycleEvent(storageKey);
    if (record && /^[a-f0-9]{64}$/.test(record.event_id)) {
        const expectedStation = String(station || "").trim().toUpperCase();
        const expectedProcess = String(process || "").trim().toUpperCase();
        if (record.station !== expectedStation || record.process !== expectedProcess || record.pallet_id !== palletId) {
            throw new Error("Dziennik oczekującego cyklu nie pasuje do bieżącej stacji, procesu lub palety");
        }
        return {eventId: record.event_id, storageKey};
    }

    const eventId = generateCycleEventId();
    try {
        localStorage.setItem(storageKey, JSON.stringify({
            event_id: eventId,
            station: String(station || "").trim().toUpperCase(),
            process: String(process || "").trim().toUpperCase(),
            pallet_id: palletId,
            created_at: new Date().toISOString(),
        }));
    } catch (error) {
        throw new Error("Nie można zapisać dziennika cyklu w przeglądarce", {cause: error});
    }
    return {eventId, storageKey};
}

function updatePendingCycleEvent(storageKey, eventId, palletId, unitIds) {
    const existingRecord = readPendingCycleEvent(storageKey);
    if (existingRecord?.ready_to_register && existingRecord.event_id === eventId) {
        const previousUnitIds = Array.isArray(existingRecord.unit_ids) ? [...new Set(existingRecord.unit_ids.map((value) => String(value).trim().toUpperCase()).filter(Boolean))].sort() : [];
        if (JSON.stringify(previousUnitIds) !== JSON.stringify(unitIds)) {
            throw new Error("Oczekujący cykl zawiera inny zestaw sztuk. Nie ponawiaj zapisu i odśwież stronę, aby najpierw uzgodnić poprzedni cykl.",);
        }
        return;
    }
    try {
        localStorage.setItem(storageKey, JSON.stringify({
            event_id: eventId,
            station: String(station || "").trim().toUpperCase(),
            process: String(process || "").trim().toUpperCase(),
            pallet_id: palletId,
            unit_ids: unitIds,
            ready_to_register: true,
            updated_at: new Date().toISOString(),
        }));
    } catch (error) {
        throw new Error("Nie można zaktualizować dziennika cyklu w przeglądarce", {cause: error});
    }
}

function validateCycleResponse(result, palletId, eventId) {
    const validCounters = Number.isSafeInteger(result?.current_cycles) && result.current_cycles >= 0 && Number.isSafeInteger(result?.total_cycles) && result.total_cycles >= 0;
    if (!result || typeof result !== "object" || result.status !== true || typeof result.cycle_recorded !== "boolean" || String(result.event_id || "").toLowerCase() !== eventId || String(result.pallet_id || "").trim().toUpperCase() !== palletId || !PALLET_STATUSES.has(result.pallet_status) || !validCounters) {
        throw new Error(result?.message || "Encore zwrócił nieprawidłowe potwierdzenie cyklu palety");
    }
    return result;
}

async function registerCycleInEncore(palletId, eventId, unitIds) {
    const result = await encoreCall(`/fis/soldering/pallets/${encodeURIComponent(palletId)}/cycles`, {
        method: "POST", body: JSON.stringify({
            event_id: eventId, station, process, unit_ids: unitIds,
        }),
    });
    return validateCycleResponse(result, palletId, eventId);
}

async function reconcilePendingCycleEvent(palletId) {
    const storageKey = pendingCycleStorageKey(palletId);
    const record = readPendingCycleEvent(storageKey);
    if (!record?.ready_to_register || !/^[a-f0-9]{64}$/.test(record.event_id) || !Array.isArray(record.unit_ids) || record.unit_ids.length === 0 || record.pallet_id !== palletId || record.station !== String(station || "").trim().toUpperCase() || record.process !== String(process || "").trim().toUpperCase()) {
        return null;
    }
    const unitIds = [...new Set(record.unit_ids.map((value) => String(value).trim().toUpperCase()).filter(Boolean))].sort();
    if (unitIds.length === 0) return null;
    const result = await registerCycleInEncore(palletId, record.event_id, unitIds);
    completePendingCycleEvent(storageKey, record.event_id);
    return result;
}

function completePendingCycleEvent(storageKey, eventId) {
    try {
        const record = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (record?.event_id === eventId) {
            localStorage.removeItem(storageKey);
        }
    } catch (error) {
        console.error("Nie udało się usunąć potwierdzonego wpisu cyklu:", error);
    }
}

function cycleReplayNotice(palletEntryResult) {
    return palletEntryResult?.data?.cycle_recorded === false ? "<br>Powtórzenie rozpoznane — cykl nie został naliczony drugi raz." : "";
}

function showPendingCycleError(palletEntryResult) {
    if (!palletEntryResult?.retry_safe) {
        showError("Operacje procesu zostały zapisane w FIS, ale nie udało się utrwalić danych potrzebnych do bezpiecznego ponowienia cyklu.<br>" + "Nie ponawiaj operacji i skontaktuj się z inżynierem lub IT.<br>" + (palletEntryResult?.message || "Brak szczegółów błędu"), 15000,);
        return;
    }
    if (!palletEntryResult.automatic_reconcile) {
        showError("Operacje procesu zostały zapisane w FIS, ale Encore odrzuciło cykl palety.<br>" + "Nie ponawiaj operacji i skontaktuj się z inżynierem lub IT.<br>" + (palletEntryResult?.message || "Brak szczegółów błędu"), 15000,);
        return;
    }
    showError("Operacje procesu zostały zapisane w FIS, ale Encore nie potwierdziło cyklu palety.<br>" + "Nie wykonuj operacji na sztukach ponownie. Po zamknięciu komunikatu zeskanuj ponownie tylko paletę — zapis zostanie uzgodniony automatycznie.<br>" + (palletEntryResult?.message || "Brak szczegółów błędu"), 12000, resetProcessForms,);
}

function formatFisWriteFailure(message, result, completedWrites) {
    const requiresReview = completedWrites > 0 || isRouterTransportFailure(result) || /(already|już.*(zapis|link)|istniejący link)/i.test(String(result?.message || ""));
    return {
        requiresReview,
        message: requiresReview ? message + "<br>Stan procesu w FIS może być częściowo zapisany. Nie ponawiaj operacji i skontaktuj się z inżynierem lub IT." : message,
    };
}

const unitCheck = (fd) => apiCall("unitCheck", fd);

/* --- Przeniesione na router FIS --------------------------------------------- */
const unitFilter = (fd) => routerCall("Unit_Filter", fdToRouterPayload(fd));
const unitFind = (fd) => routerCall("Unit_Find", fdToRouterPayload(fd));
const timeCheck = (fd) => routerCall("TimeCheck", fdToRouterPayload(fd));
const childrenCheck = (fd) => routerCall("Unit_GetChildren", fdToRouterPayload(fd));
const parentCheck = (fd) => routerCall("Unit_GetParent", fdToRouterPayload(fd));
const Get_Unit_Status = (fd) => routerCall("Unit_GetStatus", fdToRouterPayload(fd));
const dataEntry = (fd) => routerCall("Unit_DataEntry", fdToRouterPayload(fd));
const unitLink = (fd) => routerCall("Unit_Link", fdToRouterPayload(fd));

function isRouterTransportFailure(result) {
    return result?.failure_kind === "transport";
}

function routerReason(result) {
    return String(result?.reason ?? result?.code ?? result?.error_code ?? "").trim().toUpperCase();
}

function isExpectedUnitNotFound(result) {
    const reason = routerReason(result);
    const message = String(result?.message || "");
    return ["UNIT_NOT_FOUND", "NOT_FOUND", "UNKNOWN_UNIT"].includes(reason) || /(unit|sztuk).*(not found|nie znalezion|nie istnieje|unknown)|nieznan.*(unit|sztuk)/i.test(message);
}

function isExpectedMissingParent(result) {
    const reason = routerReason(result);
    const message = String(result?.message || "");
    return ["NO_PARENT", "PARENT_NOT_FOUND", "NOT_LINKED", "UNIT_NOT_LINKED"].includes(reason) || /(no parent|parent.*not found|brak parent|nie ma parent|not linked|nie.*zlinkowan)/i.test(message);
}

function showRouterTransportError(operation, result, unit = "") {
    const unitLine = unit ? `${unit}<br>` : "";
    showError(`${unitLine}Błąd komunikacji z routerem FIS podczas ${operation}!<br>` + (result?.message || "Brak szczegółów błędu"), 8000,);
}

function showMessage(msg, colorClass, timeout = 3000, callback = null) {
    if (messageTimerId !== null) {
        clearTimeout(messageTimerId);
    }
    document.body.classList.remove(...UI_COLORS, "animate-pulse");
    document.body.classList.add(colorClass, "animate-pulse");

    const messageBox = document.getElementById("messagebox");
    if (!messageBox) {
        console.error("Brak elementu #messagebox:", msg);
        return;
    }
    const heading = document.createElement("h1");
    heading.className = "text-xl text-center m-10";
    String(msg || "Brak szczegółów błędu")
        .split(/<br\s*\/?\s*>/i)
        .forEach((line, index) => {
            if (index > 0) heading.appendChild(document.createElement("br"));
            heading.appendChild(document.createTextNode(line));
        });
    messageBox.replaceChildren(heading);
    messageBox.classList.remove(...UI_COLORS);
    messageBox.classList.add(colorClass);

    messageTimerId = setTimeout(() => {
        document.body.classList.remove(colorClass, "animate-pulse");
        messageTimerId = null;
        if (callback) {
            callback();
        }
    }, timeout);
}

function showError(msg, timeout = 3000, callback = null) {
    showMessage(msg, "bg-[red]", timeout, callback);
}

function showSuccess(msg, timeout = 3000, callback = null) {
    showMessage(msg, "bg-teal-200", timeout, callback);
}

function showWarning(msg, timeout = 4000, callback = null) {
    showMessage(msg, "bg-[orange]", timeout, callback);
}

function resetProcessForms() {
    document
        .querySelectorAll("#formBox > form:not(#palletForm), " + "#formBox > #childDiv")
        .forEach((element) => {
            element.remove();
        });
    const palletForm = document.getElementById("palletForm");
    const palletInput = document.getElementById("palletSerialNumber");
    palletForm?.reset();
    if (palletInput) {
        palletInput.disabled = false;
        palletInput.focus();
    }
}

async function runFormHandlerOnce(form, handler) {
    if (!form || form.dataset.processing === "1" || unitCheckInProgress) {
        return;
    }
    form.dataset.processing = "1";
    unitCheckInProgress = true;
    try {
        await handler();
    } finally {
        unitCheckInProgress = false;
        delete form.dataset.processing;
    }
}

function fdToRouterPayload(fd, extra = {}) {
    const map = {
        process: "Process",
        station: "Station",
        dc: "DcString",
        parent: "parent",
        child: "child",
        palletSerialNumber: "PalletSN",
    };

    const out = {};

    for (const [key, value] of fd.entries()) {
        const target = map[key];
        if (target !== undefined) out[target] = value;
    }

    const unit = fd.get("unit") ?? fd.get("unitSerialNumber");
    if (unit !== null && unit !== undefined) out.Unit = unit;

    return {...out, ...extra};
}

function resolveComponentConfig(partNumber) {
    const normalizedConfig = String(configFile || "")
        .replaceAll("{", "")
        .replaceAll("}", "")
        .trim();
    if (!normalizedConfig) {
        return null;
    }
    const normalizedPartNumber = String(partNumber || "").trim().toUpperCase();
    const entries = normalizedConfig
        .split(/\s+/)
        .filter(Boolean)
        .map((entry) => entry.split("|"));
    const match = entries.find((entry) => String(entry[1] || "").trim().toUpperCase() === normalizedPartNumber);
    if (!match) {
        // Brak wpisu oznacza wariant bez dodatkowych PM/sensorów.
        return null;
    }

    const configuredSensorQuantity = Number(match[4] || 0);
    if (!Number.isInteger(configuredSensorQuantity) || configuredSensorQuantity < 0 || configuredSensorQuantity > 100) {
        throw new Error(`Nieprawidłowa liczba sensorów w konfiguracji dla ${normalizedPartNumber}`);
    }
    const configuredSensorPn = String(match[3] || "").trim().toUpperCase();
    if (configuredSensorQuantity > 0 && !configuredSensorPn) {
        throw new Error(`Brak Part Number sensora w konfiguracji dla ${normalizedPartNumber}`);
    }
    return {
        powerModulePartNumber: String(match[2] || "").trim().toUpperCase(),
        sensorPartNumber: configuredSensorPn,
        sensorQuantity: configuredSensorQuantity,
    };
}

document.addEventListener("DOMContentLoaded", function () {
    palletSerialNumber = document.getElementById("palletSerialNumber");
    configFile = document.getElementById("configFile")?.value || "";
    process = document
        .getElementById("process")
        ?.textContent?.trim() || "";
    station = document
        .getElementById("station")
        ?.textContent?.trim() || "";
    instruction_needed = Number(document.getElementById("instruction_needed")?.textContent || 1);
    console.log("page loaded for", process, "and station", station);
    const palletSerialNumAuto = getQueryVariable("palletSerialNumber");
    console.log("pallet Serial Number Auto", palletSerialNumAuto);
    document
        .getElementById("palletForm")
        ?.addEventListener("submit", formHandler);
    if (palletSerialNumAuto !== undefined) {
        palletSerialNumber.value = palletSerialNumAuto;
        formHandler();
    } else {
        palletSerialNumber.focus();
    }
});

async function unitReview(unit) {
    const normalizedUnit = String(unit || "")
        .trim()
        .toUpperCase();
    if (!normalizedUnit) {
        showError("Brak numeru sztuki!");
        return {
            status: false, message: "Brak numeru sztuki",
        };
    }
    const data = new FormData();
    data.set("unitSerialNumber", normalizedUnit);
    data.set("process", process);
    try {
        const unitFilterVal = await unitFilter(data);

        console.log("unitFilterVal:", unitFilterVal);

        if (!unitFilterVal?.status) {
            showError(normalizedUnit + "<br>" + (unitFilterVal?.message || "Błąd unitFilter"), 6000);

            return {
                status: false, message: unitFilterVal?.message || "Błąd unitFilter", data: null
            };
        }

        const filteredUnit = unitFilterVal.data || normalizedUnit;

        const checkData = new FormData();

        checkData.set("unitSerialNumber", filteredUnit);

        checkData.set("process", process);

        const unitFindVal = await unitFind(checkData);

        console.log("unitFindVal:", unitFindVal);

        if (isRouterTransportFailure(unitFindVal)) {
            showRouterTransportError("wyszukiwania sztuki", unitFindVal, filteredUnit);
            return {
                status: false,
                message: unitFindVal.message || "Błąd komunikacji podczas wyszukiwania sztuki",
                data: null,
            };
        }
        if (!unitFindVal?.status) {
            if (!isExpectedUnitNotFound(unitFindVal)) {
                showError(`${filteredUnit}<br>FIS nie potwierdził, że sztuka jest nowa.<br>` + (unitFindVal?.message || "Brak kodu UNIT_NOT_FOUND"), 8000,);
                return {
                    status: false,
                    message: unitFindVal?.message || "Niejednoznaczny wynik wyszukiwania sztuki",
                    data: null,
                };
            }
            console.log("Sztuka nieznana w FIS, pomijam timeCheck:", filteredUnit);

            return {
                status: true, message: unitFindVal?.message || "Unit not found", data: filteredUnit, exists: false
            };
        }

        const timeCheckVal = await timeCheck(checkData);
        console.log("timeCheckVal:", timeCheckVal);
        if (!timeCheckVal?.status) {
            showError(normalizedUnit + "<br>" + (timeCheckVal?.message || "Błąd timeCheck"), 6000);
            return {
                status: false, message: timeCheckVal?.message,
            };
        }

        return {
            status: true, message: timeCheckVal.message || "OK", data: filteredUnit, exists: true
        };
    } catch (error) {
        console.error("unitReview error for", normalizedUnit, error);
        showError(normalizedUnit + "<br>Błąd komunikacji z serwerem!<br>" + (error?.message || "Brak szczegółów błędu"), 8000);
        return {
            status: false, message: error?.message || "Błąd komunikacji",
        };
    }
}

function getQueryVariable(variable) {
    const value = new URLSearchParams(window.location.search).get(variable);
    return value === null ? undefined : value;
}

async function focusNext(callbackFunc) {
    console.log("=== focusNext START ===");
    console.log("inputs:", inputs);
    if (!inputs.length) {
        console.error("focusNext: tablica inputs jest pusta");
        showError("Tablica inputs jest pusta!");
        return;
    }
    const currInput = document.activeElement;
    const currInputIndex = inputs.indexOf(currInput);
    console.log("Aktualny input:", currInput);
    console.log("Indeks aktualnego inputu:", currInputIndex);
    if (currInputIndex === -1) {
        console.error("focusNext: aktualnego inputu nie ma w tablicy inputs", currInput);
        showError("UWAGA: Aktualnego inputu NIE MA w tablicy 'inputs'!");
        return;
    }
    const nextInputIndex = (currInputIndex + 1) % inputs.length;
    const nextInput = inputs[nextInputIndex];
    const emptyInputs = inputs.filter((element) => String(element.value || "").trim() === "");
    console.log("Następny input:", nextInput);
    console.log("Puste inputy:", emptyInputs.map((element) => element.id || element.name));
    if (currInputIndex + 1 === inputs.length && emptyInputs.length === 0) {
        if (typeof callbackFunc !== "function") {
            console.error("focusNext: callbackFunc nie jest funkcją", callbackFunc);
            showError("Błąd aplikacji: brak funkcji kończącej proces!");
            return;
        }
        try {
            console.log("focusNext: wszystkie pola wypełnione, uruchamiam callback");
            await callbackFunc();
        } catch (error) {
            console.error("focusNext callback error:", error);
            showError("Nieoczekiwany błąd podczas kończenia procesu!<br>" + (error?.message || "Brak szczegółów błędu"), 8000);
        }
    } else {
        nextInput?.focus();
    }
    console.log("=== focusNext END ===");
}

async function dataEntryFunc() {
    if (processSaveInProgress) {
        return;
    }
    processSaveInProgress = true;
    let processCompleted = false;
    let lockForReview = false;
    let fisWritesCompleted = 0;
    const previousDisabledStates = new Map(inputs.map((input) => [input, input.disabled,]));
    console.log("=== dataEntryFunc START ===");
    console.log("DEBUG:", {
        process, station, pallet: palletSerialNumber?.value,
    });
    try {
        inputs.forEach((input) => {
            input.disabled = true;
        });
        const topLevelForms = Array.from(document.querySelectorAll("#childDiv > form"));
        console.log("DEBUG: top-level nest forms:", topLevelForms.map((form) => form.id));
        if (!topLevelForms.length) {
            showError("Brak formularzy sztuk do zapisania!");
            return;
        }
        const successUnits = [];
        const fd = new FormData();
        fd.set("process", process);
        fd.set("station", station);
        for (const form of topLevelForms) {
            const rootInput = form.querySelector('input[name="unitSerialNumber"]');
            const rootUnit = String(rootInput?.value || "")
                .trim()
                .toUpperCase();
            if (!rootUnit) {
                showError("Brak numeru sztuki w formularzu " + form.id + "!", 6000);
                return;
            }
            if (!successUnits.includes(rootUnit)) {
                successUnits.push(rootUnit);
            }
            const detailDivs = Array.from(form.querySelectorAll('div[name="palletFormDiv2"]'));
            let lastDc = `PALLET|` + `${palletSerialNumber.value.toUpperCase()}`;
            let hadRealChild = false;
            if (detailDivs.length === 0) {
                console.warn("Brak divów szczegółowych dla", rootUnit, "- zapisuję samą sztukę");
            }
            for (const detailDiv of detailDivs) {
                const childInput = detailDiv.querySelector('input[name="childSerialNumber"]');
                const targetUnit = String(childInput?.value || rootUnit)
                    .trim()
                    .toUpperCase();
                const powerModuleInput = detailDiv.querySelector('input[name="powerModuleSn"]');
                const powerModuleSn = String(powerModuleInput?.value || "")
                    .trim()
                    .toUpperCase();
                const sensorInputs = Array.from(detailDiv.querySelectorAll('input[name="sensorSn"]'));
                const sensorValues = sensorInputs
                    .map((input) => String(input.value || "")
                        .trim()
                        .toUpperCase())
                    .filter(Boolean);
                const sensorQuan = sensorValues.length;
                const localSensorPn = sensorValues.length ? sensorValues[sensorValues.length - 1].slice(-11) : "";
                hadRealChild = hadRealChild || Boolean(childInput);
                if (sensorQuan > 0 && powerModuleSn !== "") {
                    lastDc = `SENSORPN|${localSensorPn}` + `|SENSORQTY|${sensorQuan}` + `|POWERMOD|${powerModuleSn}` + `|PARENT|${rootUnit}` + `|PALLET|${palletSerialNumber.value.toUpperCase()}`;
                } else if (sensorQuan > 0) {
                    lastDc = `SENSORPN|${localSensorPn}` + `|SENSORQTY|${sensorQuan}` + `|PALLET|${palletSerialNumber.value.toUpperCase()}`;
                } else if (powerModuleSn !== "") {
                    lastDc = `POWERMOD|${powerModuleSn}` + `|PARENT|${rootUnit}` + `|PALLET|${palletSerialNumber.value.toUpperCase()}`;
                } else {
                    lastDc = `PARENT|${rootUnit}` + `|PALLET|${palletSerialNumber.value.toUpperCase()}`;
                }
                console.log("DEBUG: nest detail", {
                    form: form.id, rootUnit, targetUnit, powerModuleSn, sensorQuan, dc: lastDc,
                });
                if (powerModuleSn) {
                    fd.set("parent", targetUnit);
                    fd.set("child", powerModuleSn);
                    const unitLinkStatus = await unitLink(fd);
                    console.log("DEBUG: unitLink", {
                        targetUnit, powerModuleSn, unitLinkStatus,
                    });
                    if (!unitLinkStatus?.status) {
                        const failure = formatFisWriteFailure("Błąd linkowania!<br>" + "Parent: " + targetUnit + "<br>Power Module: " + powerModuleSn + "<br>" + (unitLinkStatus?.message || "Brak szczegółów"), unitLinkStatus, fisWritesCompleted,);
                        lockForReview = failure.requiresReview;
                        showError(failure.message, lockForReview ? 15000 : 8000);
                        return;
                    }
                    fisWritesCompleted++;
                    fd.set("unit", powerModuleSn);
                    fd.set("dc", lastDc);
                    const pmEntry = await dataEntry(fd);
                    console.log("DEBUG: PM dataEntry", pmEntry);
                    if (!pmEntry?.status) {
                        const failure = formatFisWriteFailure("Błąd zapisu Power Module!<br>" + powerModuleSn + "<br>" + (pmEntry?.message || "Brak szczegółów"), pmEntry, fisWritesCompleted,);
                        lockForReview = failure.requiresReview;
                        showError(failure.message, lockForReview ? 15000 : 8000);
                        return;
                    }
                    fisWritesCompleted++;
                }
                if (childInput) {
                    fd.set("unit", targetUnit);
                    fd.set("dc", lastDc);
                    const childEntry = await dataEntry(fd);
                    console.log("DEBUG: CHILD dataEntry", {
                        targetUnit, childEntry,
                    });
                    if (!childEntry?.status) {
                        const failure = formatFisWriteFailure("Błąd zapisu CHILD!<br>" + targetUnit + "<br>" + (childEntry?.message || "Brak szczegółów"), childEntry, fisWritesCompleted,);
                        lockForReview = failure.requiresReview;
                        showError(failure.message, lockForReview ? 15000 : 8000);
                        return;
                    }
                    fisWritesCompleted++;
                }
            }
            fd.set("unit", rootUnit);
            fd.set("dc", lastDc);
            const rootEntry = await dataEntry(fd);
            console.log("DEBUG: ROOT dataEntry", {
                rootUnit, hadRealChild, rootEntry,
            });
            if (!rootEntry?.status) {
                const failure = formatFisWriteFailure("Błąd zapisu sztuki!<br>" + rootUnit + "<br>" + (rootEntry?.message || "Brak szczegółów"), rootEntry, fisWritesCompleted,);
                lockForReview = failure.requiresReview;
                showError(failure.message, lockForReview ? 15000 : 8000);
                return;
            }
            fisWritesCompleted++;
        }
        fd.set("palletSerialNumber", palletSerialNumberValue || palletSerialNumber.value.toUpperCase());
        const palletEntryResult = await palletEntry(fd);
        console.log("DEBUG: palletEntry result:", palletEntryResult);
        if (!palletEntryResult?.status) {
            processCompleted = true;
            showPendingCycleError(palletEntryResult);
            return;
        }
        if (Number(document.getElementById("palletSerialNumber").dataset.vacuum_check) === 1) {
            document.getElementById("palletSerialNumber").dataset.vacuum_check = 0;
        }
        console.log("SUCCESS:", {
            pallet: palletSerialNumber.value, units: successUnits,
        });
        processCompleted = true;
        showSuccess(palletSerialNumber.value + " Proces poprawny dla:<br>" + successUnits.join("<br>") + cycleReplayNotice(palletEntryResult), 3000, () => {
            resetProcessForms();
        },);
    } catch (error) {
        console.error("dataEntryFunc error:", error);
        lockForReview = fisWritesCompleted > 0;
        const suffix = lockForReview ? "<br>Stan procesu w FIS może być częściowo zapisany. Nie ponawiaj operacji i skontaktuj się z inżynierem lub IT." : "";
        showError("Nieoczekiwany błąd zapisu procesu!<br>" + (error?.message || "Brak szczegółów błędu") + suffix, lockForReview ? 15000 : 8000);
    } finally {
        processSaveInProgress = false;
        if (!processCompleted && !lockForReview) {
            previousDisabledStates.forEach((wasDisabled, input) => {
                if (input.isConnected) {
                    input.disabled = wasDisabled;
                }
            });
            inputs
                .find((input) => input.isConnected && !input.disabled)
                ?.focus();
        }
    }
}

async function powerSensCheck() {
    if (processSaveInProgress) {
        return;
    }
    processSaveInProgress = true;
    let processCompleted = false;
    let lockForReview = false;
    let fisWritesCompleted = 0;
    const previousDisabledStates = new Map(inputs.map((input) => [input, input.disabled,]));
    console.log("=== powerSensCheck START ===");
    try {
        const allChildrenQty = document.querySelectorAll('input[name="childSerialNumber"]').length;
        console.log("allChildrenQty:", allChildrenQty);
        inputs.forEach((element) => {
            element.disabled = true;
        });
        const allDivs = document.querySelectorAll('div[name="palletFormDiv2"]');
        console.log("allDivs length:", allDivs.length);
        if (!allDivs.length) {
            showError("Brak danych sztuki do zapisania!");
            return;
        }
        const childList = [];
        let childrenCount = 0;
        const fd = new FormData();
        fd.set("process", process);
        fd.set("station", station);
        for (let i = 0; i < allDivs.length; i++) {
            console.log(`=== powerSensCheck ITERATION ${i} ===`);
            const newArray = allDivs[i].children;
            let children = "";
            let powerModuleSn = "";
            for (let index = 0; index < newArray.length; index++) {
                const child = newArray[index];
                console.log("child element:", child.name, child.value);
                if (child.name === "childSerialNumber") {
                    children = String(child.value || "")
                        .trim()
                        .toUpperCase();
                    if (children && !childList.includes(children)) {
                        childList.push(children);
                    }
                } else if (child.name === "powerModuleSn") {
                    powerModuleSn = String(child.value || "")
                        .trim()
                        .toUpperCase();
                }
            }
            childrenCount = childList.length;
            sensorQuantity = Number(sensorQuantity);
            palletSerialNumber.value = palletSerialNumber.value.toUpperCase();
            let dc = "";
            if (sensorQuantity > 0 && powerModuleSn !== "") {
                dc = `SENSORPN|${sensorPn}` + `|SENSORQTY|${sensorQuantity}` + `|POWERMOD|${powerModuleSn}` + `|PARENT|${unitSerialNumberValue}` + `|PALLET|${palletSerialNumber.value}`;
            } else if (sensorQuantity > 0) {
                dc = `SENSORPN|${sensorPn}` + `|SENSORQTY|${sensorQuantity}` + `|PALLET|${palletSerialNumber.value}`;
            } else if (powerModuleSn !== "") {
                dc = `POWERMOD|${powerModuleSn}` + `|PARENT|${unitSerialNumberValue}` + `|PALLET|${palletSerialNumber.value}`;
            } else {
                dc = `PARENT|${unitSerialNumberValue}` + `|PALLET|${palletSerialNumber.value}`;
            }
            if (!children) {
                console.warn("children EMPTY -> fallback to parent", unitSerialNumberValue);
                children = String(unitSerialNumberValue || "")
                    .trim()
                    .toUpperCase();
            }
            if (!children) {
                showError("Brak numeru sztuki/parenta do zapisania!", 6000);
                return;
            }
            console.log("powerSensCheck data:", {
                children, powerModuleSn, dc,
            });
            if (powerModuleSn !== "") {
                fd.set("parent", children);
                fd.set("child", powerModuleSn);
                const unitLinkStatus = await unitLink(fd);
                console.log("unitLinkStatus:", unitLinkStatus);
                if (!unitLinkStatus?.status) {
                    const failure = formatFisWriteFailure("Błąd linkowania!<br>" + "Parent: " + children + "<br>Power Module: " + powerModuleSn + "<br>" + (unitLinkStatus?.message || "Brak szczegółów"), unitLinkStatus, fisWritesCompleted,);
                    lockForReview = failure.requiresReview;
                    showError(failure.message, lockForReview ? 15000 : 8000);
                    return;
                }
                fisWritesCompleted++;
                fd.set("unit", powerModuleSn);
                fd.set("dc", dc);
                const dataEntryPM = await dataEntry(fd);
                console.log("dataEntryPM:", dataEntryPM);
                if (!dataEntryPM?.status) {
                    const failure = formatFisWriteFailure("Błąd zapisu Power Module!<br>" + powerModuleSn + "<br>" + (dataEntryPM?.message || "Brak szczegółów"), dataEntryPM, fisWritesCompleted,);
                    lockForReview = failure.requiresReview;
                    showError(failure.message, lockForReview ? 15000 : 8000);
                    return;
                }
                fisWritesCompleted++;
            }
            if (allChildrenQty > 0) {
                fd.set("unit", children);
                fd.set("dc", dc);
                const dataEntryChild = await dataEntry(fd);
                console.log("dataEntry CHILD STATUS:", dataEntryChild);
                if (!dataEntryChild?.status) {
                    const failure = formatFisWriteFailure("Błąd zapisu CHILD!<br>" + children + "<br>" + (dataEntryChild?.message || "Brak szczegółów"), dataEntryChild, fisWritesCompleted,);
                    lockForReview = failure.requiresReview;
                    showError(failure.message, lockForReview ? 15000 : 8000);
                    return;
                }
                fisWritesCompleted++;
            }
            console.log("CHECK finish:", childrenCount, "==", allChildrenQty);
            if (childrenCount === allChildrenQty) {
                fd.set("unit", unitSerialNumberValue);
                fd.set("dc", dc);
                const dataEntryParent = await dataEntry(fd);
                console.log("dataEntry PARENT STATUS:", dataEntryParent);
                if (!dataEntryParent?.status) {
                    const failure = formatFisWriteFailure("Błąd zapisu PARENT!<br>" + unitSerialNumberValue + "<br>" + (dataEntryParent?.message || "Brak szczegółów"), dataEntryParent, fisWritesCompleted,);
                    lockForReview = failure.requiresReview;
                    showError(failure.message, lockForReview ? 15000 : 8000);
                    return;
                }
                fisWritesCompleted++;
                fd.set("palletSerialNumber", palletSerialNumberValue || palletSerialNumber.value.toUpperCase());
                const palletEntryResult = await palletEntry(fd);
                console.log("palletEntryResult:", palletEntryResult);
                if (!palletEntryResult?.status) {
                    processCompleted = true;
                    showPendingCycleError(palletEntryResult);
                    return;
                }
                if (Number(document.getElementById("palletSerialNumber").dataset.vacuum_check) === 1) {
                    document.getElementById("palletSerialNumber").dataset.vacuum_check = 0;
                }
                const successUnits = childList.length ? [...new Set(childList.filter(Boolean)),] : [unitSerialNumberValue,].filter(Boolean);
                console.log("SUCCESS:", {
                    pallet: palletSerialNumber.value, units: successUnits,
                });
                processCompleted = true;
                showSuccess(palletSerialNumber.value + " Proces poprawny dla:<br>" + successUnits.join("<br>") + cycleReplayNotice(palletEntryResult), 3000, () => {
                    resetProcessForms();
                },);
                return;
            }
        }
    } catch (error) {
        console.error("powerSensCheck error:", error);
        lockForReview = fisWritesCompleted > 0;
        const suffix = lockForReview ? "<br>Stan procesu w FIS może być częściowo zapisany. Nie ponawiaj operacji i skontaktuj się z inżynierem lub IT." : "";
        showError("Nieoczekiwany błąd zapisu procesu!<br>" + (error?.message || "Brak szczegółów błędu") + suffix, lockForReview ? 15000 : 8000);
    } finally {
        processSaveInProgress = false;
        if (!processCompleted && !lockForReview) {
            previousDisabledStates.forEach((wasDisabled, input) => {
                if (input.isConnected) {
                    input.disabled = wasDisabled;
                }
            });
            inputs
                .find((input) => input.isConnected && !input.disabled)
                ?.focus();
        }
    }
    console.log("=== powerSensCheck END ===");
}

async function formHandler(event) {
    document
        .getElementById("messagebox")
        .classList.remove(...UI_COLORS);
    document.getElementById("messagebox").innerHTML = "";
    console.log("formHandler submitted");
    if (event) {
        event.preventDefault();
    }
    if (palletCheckInProgress) {
        return;
    }
    palletCheckInProgress = true;
    palletSerialNumber = document.getElementById("palletSerialNumber");
    palletSerialNumberValue = palletSerialNumber.value
        .trim()
        .toUpperCase();
    console.log(palletSerialNumberValue);
    const fd = new FormData();
    fd.append("process", process);
    fd.append("palletSerialNumber", palletSerialNumberValue);
    try {
        const reconciledCycle = await reconcilePendingCycleEvent(palletSerialNumberValue);
        if (reconciledCycle) {
            console.info("Poprzedni oczekujący cykl został potwierdzony przez Encore:", reconciledCycle);
        }
        const checkedPallet = await getPalletFromEncore(fd);
        console.log("Encore pallet:", checkedPallet);
        const isFis2Host = window.location.hostname.toLowerCase() === FIS2_HOSTNAME;
        if (checkedPallet.fis === 2 && !isFis2Host) {
            palletSerialNumber.disabled = true;
            showMessage("redirecting to FIS2...", "bg-teal-400", 4000);
            setTimeout(() => {
                window.location.replace(`http://${FIS2_HOSTNAME}/cst_public/jj00sp_soldering.cgi?` + `palletSerialNumber=${encodeURIComponent(palletSerialNumberValue)}`,);
            }, 500);
            return;
        }
        if (checkedPallet.status !== ACTIVE_PALLET_STATUS) {
            const statusMessages = {
                Washing_Required: "Paleta wymaga mycia!<br>Użyj innej palety!",
                Damaged: "Paleta jest uszkodzona!<br>Użyj innej palety!",
                Blocked: "Paleta jest zablokowana!<br>Użyj innej palety!",
            };
            palletSerialNumber.value = "";
            showError(statusMessages[checkedPallet.status] || "Paleta nie ma aktywnego statusu!<br>Użyj innej palety!", 8000,);
            return;
        }
        const current_cycles = requireFiniteNumber(checkedPallet.current_cycles, "current_cycles");
        const max_cycles = requireFiniteNumber(checkedPallet.max_cycles, "max_cycles");
        nests = requireFiniteNumber(checkedPallet.nests, "nests");
        if (!Number.isInteger(nests) || nests < 1 || max_cycles <= 0 || current_cycles < 0) {
            throw new Error("Encore zwrócił nieprawidłową konfigurację palety");
        }

        if (current_cycles >= max_cycles) {
            const msg = "Paleta przekroczyła ilość cykli!<br>" + "Użyj innej, a tę oddaj do czyszczenia!";
            showError(msg, 6000);
            palletSerialNumber.value = "";
            palletSerialNumber.focus();
            return;
        }

        if (max_cycles - current_cycles <= 20) {
            const msg = "Paleta niedługo przekroczy ilość cykli!<br>" + "Pozostała ilość cykli: " + Number(max_cycles - current_cycles);
            showWarning(msg, 20000);
        } else if (0.95 * max_cycles <= current_cycles) {
            const msg = "Paleta niedługo przekroczy ilość cykli!<br>" + "Po użyciu oddaj do czyszczenia!";
            showWarning(msg, 4000);
        }
        // Identyfikator powstaje przed pierwszym zapisem do FIS i przeżywa retry/reload.
        ensurePendingCycleEvent(palletSerialNumberValue);
    } catch (error) {
        console.error("formHandler error:", error);
        let errorMessage = "Błąd sprawdzania palety!<br>" + getEncoreErrorMessage(error, "Brak szczegółów błędu");
        if (error instanceof EncoreHttpError && error.status === 404) {
            errorMessage = "To nie jest numer zarejestrowanej palety!<br>Spróbuj ponownie.";
            palletSerialNumber.value = "";
        } else if (error instanceof EncoreHttpError && (error.status === 401 || error.status === 403)) {
            errorMessage = "Brak autoryzacji do Encore!<br>Skontaktuj się z administratorem.";
        }
        showError(errorMessage, 8000);
        palletSerialNumber.disabled = false;
        palletSerialNumber.focus();
        return;
    } finally {
        palletCheckInProgress = false;
    }
    const instructionOverlay = document.getElementById("vacuum_instruction");
    if (Number(palletSerialNumber.dataset.vacuum_check) === 0 && instruction_needed) {
        palletSerialNumber.disabled = true;
        let timeleft = 14;
        let timertext = "sekund";
        instructionOverlay.style.setProperty("display", "flex", "important");
        document.getElementById("vacuum_instruction_button_container").innerHTML = `
            <button
                id="vacuum_instruction_button"
                disabled
                class="flex items-center gap-4 font-bold py-4 px-10 rounded-xl
                       text-sm tracking-wider uppercase
                       bg-gradient-to-r from-amber-400 to-amber-600
                       text-amber-950 opacity-50 cursor-not-allowed
                       transition-all duration-200"
            >
                <span class="relative w-8 h-8 shrink-0">
                    <svg
                        class="w-8 h-8"
                        style="transform:rotate(-90deg);"
                        viewBox="0 0 44 44"
                    >
                        <circle
                            cx="22"
                            cy="22"
                            r="20"
                            fill="none"
                            stroke="rgba(0,0,0,0.2)"
                            stroke-width="3"
                        />
                        <circle
                            id="countdown_ring"
                            cx="22"
                            cy="22"
                            r="20"
                            fill="none"
                            stroke="rgba(0,0,0,0.5)"
                            stroke-width="3"
                            class="countdown-ring"
                        />
                    </svg>
                </span>
                <span id="vacuum_instruction_button_text">
                    15 sekund
                </span>
            </button>
        `;
        const buttonText = document.getElementById("vacuum_instruction_button_text");
        const instructionButton = document.getElementById("vacuum_instruction_button");
        const timerId = setInterval(() => {
            if (timeleft === 1) {
                timertext = "sekunda";
            } else if (timeleft < 5 && timeleft > 1) {
                timertext = "sekundy";
            }
            if (timeleft > 0) {
                buttonText.textContent = `${timeleft} ${timertext}`;
                timeleft--;
            } else {
                clearInterval(timerId);
                instructionButton.disabled = false;
                instructionButton.innerHTML = `
                        <svg
                            class="w-8 h-8 text-amber-950"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2.5"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                            />
                        </svg>
                        <span
                            id="vacuum_instruction_button_text"
                        >
                            KONTYNUUJ
                        </span>
                    `;
                instructionButton.classList.remove("opacity-50", "cursor-not-allowed", "from-amber-400", "to-amber-600", "text-amber-950");
                instructionButton.classList.add("cursor-pointer", "opacity-100", "from-green-500", "to-green-600", "text-green-950");
            }
        }, 1000);
        instructionButton.addEventListener("click", () => {
            palletSerialNumber.value = "";
            palletSerialNumber.disabled = false;
            palletSerialNumber.focus();
            palletSerialNumber.dataset.vacuum_check = 1;
            instructionOverlay.style.setProperty("display", "none", "important");
        });
        return;
    }
    if (nests > 1) {
        palletSerialNumber.disabled = true;
        const childContainer = document.createElement("div");
        childContainer.classList.add("flex", "flex-wrap", "justify-center", "items-center", "mt-5", "flex-row");
        childContainer.id = "childDiv";
        document
            .getElementById("formBox")
            .appendChild(childContainer);
        for (let i = 0; i < nests; i++) {
            const newForm = document.createElement("form");
            newForm.id = "palletForm01" + i;
            newForm.classList.add("flex", "flex-col", "justify-center", "items-center", "mx-3");
            newForm.addEventListener("submit", function (event) {
                event.preventDefault();
                void runFormHandlerOnce(this, () => unitHandler2(this, event));
            });
            childContainer.appendChild(newForm);
            const childDiv = document.createElement("div");
            childDiv.id = "palletFormDiv2" + i;
            childDiv.setAttribute("name", "palletFormDiv2");
            childDiv.classList.add("flex", "flex-col", "items-center", "justify-center", "p-2");
            newForm.appendChild(childDiv);
            const inputId = "unitSerialNumber" + i;
            const newLabel = createCustomLabel(inputId, "Numer sztuki " + (i + 1) + " :");
            const newInput = createCustomInput({
                id: inputId, name: "unitSerialNumber", placeholder: "Numer sztuki", required: true,
            });
            childDiv.append(newLabel, newInput);
        }
        document
            .getElementById("unitSerialNumber0")
            .focus();
        return;
    }
    const newForm = document.createElement("form");
    newForm.id = "palletForm01";
    newForm.addEventListener("submit", function (event) {
        event.preventDefault();
        void runFormHandlerOnce(this, () => unitHandler(event));
    });
    document
        .getElementById("formBox")
        .appendChild(newForm);
    const newDiv = document.createElement("div");
    newDiv.id = "palletFormDiv2";
    newDiv.classList.add("flex", "flex-col", "items-center", "justify-center");
    newForm.appendChild(newDiv);
    palletSerialNumber.disabled = true;
    const newLabel = createCustomLabel("unitSerialNumber", "Numer sztuki:");
    const newInput = createCustomInput({
        id: "unitSerialNumber", placeholder: "Numer sztuki", required: true, autofocus: true,
    });
    newDiv.append(newLabel, newInput);
    newInput.focus();
}

async function unitHandler(event) {
    if (event) {
        event.preventDefault();
    }
    const unitSerialNumber = document.getElementById("unitSerialNumber");
    const initialUnitSerialNumberValue = unitSerialNumber.value;
    const review = await unitReview(initialUnitSerialNumberValue);
    if (!review.status) {
        unitSerialNumber.value = "";
        return;
    }
    unitSerialNumber.value = review.data;
    unitSerialNumberValue = review.data;
    const fd = new FormData();
    fd.set("process", process);
    fd.set("unitSerialNumber", unitSerialNumberValue);
    let fisWritesCompleted = 0;
    try {
        const unitStatus = await unitCheck(fd);
        console.log("Unit check status:", unitStatus);
        if (!unitStatus.status) {
            unitSerialNumber.value = "";
            showError(unitSerialNumberValue + "<br>" + unitStatus.message);
            return;
        }
        goodFlag = 0;
        powerModuleToChild = "";
        sensorQuantity = 0;
        sensorPn = "";
        const response = await Get_Unit_Status(fd);
        if (!response.status) {
            unitSerialNumber.value = "";
            showError(unitSerialNumberValue + "<br>" + response.message);
            return;
        }
        const componentConfig = resolveComponentConfig(response.data.uk2);
        if (componentConfig) {
            goodFlag = 1;
            powerModuleToChild = componentConfig.powerModulePartNumber;
            sensorQuantity = componentConfig.sensorQuantity;
            sensorPn = componentConfig.sensorPartNumber;
        }
        console.log("Good Flag:", goodFlag);
        let processHousing = response.data.uk3 === "HOUSING" ? 1 : 0;
        const unitParent = await parentCheck(fd);
        if (isRouterTransportFailure(unitParent)) {
            unitSerialNumber.value = "";
            showRouterTransportError("sprawdzania parenta", unitParent, unitSerialNumberValue);
            return;
        }
        if (!unitParent?.status && !isExpectedMissingParent(unitParent)) {
            unitSerialNumber.value = "";
            showError(unitSerialNumberValue + "<br>FIS zwrócił niejednoznaczny wynik sprawdzania parenta.<br>" + (unitParent?.message || "Brak kodu NO_PARENT"), 8000,);
            return;
        }
        if (unitParent.status && unitParent.data?.startsWith?.("_ARRAY")) {
            processHousing = 1;
        }
        console.log("Process Housing:", processHousing);
        if (unitParent.status && processHousing === 0) {
            fd.set("unitSerialNumber", unitParent.data);
            const parentStatus = await unitCheck(fd);
            if (!parentStatus.status) {
                unitSerialNumber.value = "";
                showError("Parent niegotowy na process!<br>" + String(unitParent.data || "") + "<br>" + (parentStatus.message || unitParent.message || "Brak szczegółów"), 8000);
                return;
            }
            unitSerialNumber.value = parentStatus.data || unitParent.data;
            unitSerialNumberValue = unitSerialNumber.value;
            fd.set("unitSerialNumber", unitSerialNumberValue);
        }
        const unitChildren = await childrenCheck(fd);
        console.log("unitChildren:", unitChildren);
        if (!unitChildren?.status) {
            showError(unitSerialNumberValue + "<br>" + (unitChildren?.message || "Błąd pobierania childrenów"), 8000);
            return;
        }
        if (!Array.isArray(unitChildren.data)) {
            unitChildren.data = [];
        }
        console.log("unitChildren count:", unitChildren.data.length);
        if (unitChildren.data.length === 1) {
            fd.set("unitSerialNumber", unitChildren.data[0]);
            const childStatusResponse = await Get_Unit_Status(fd);
            if (!childStatusResponse?.status) {
                showError(unitChildren.data[0] + "<br>" + (childStatusResponse?.message || "Błąd pobierania statusu childrena"), 8000);
                return;
            }
            if (childStatusResponse.data?.uk3 === "HEATSINK") {
                unitChildren.data = [];
            }
            fd.set("unitSerialNumber", unitSerialNumberValue);
        }
        if (unitChildren.data.length !== 0 && processHousing === 0) {
            const childrenForm = document.createElement("form");
            childrenForm.id = "palletForm02";
            childrenForm.classList.add("flex", "flex-wrap", "justify-center", "items-center", "mt-5", "flex-row");
            document
                .getElementById("formBox")
                .appendChild(childrenForm);
            for (let i = 0; i < unitChildren.data.length; i++) {
                const childUnit = String(unitChildren.data[i] || "")
                    .trim()
                    .toUpperCase();
                fd.set("unitSerialNumber", childUnit);
                const childCheck = await unitCheck(fd);
                console.log("Child check:", childCheck);
                if (!childCheck.status) {
                    showError(childCheck.message, 6000);
                    resetProcessForms();
                    return;
                }
                unitSerialNumber.disabled = true;
                const detailDiv = document.createElement("div");
                detailDiv.id = "palletFormDiv2" + i;
                detailDiv.setAttribute("name", "palletFormDiv2");
                detailDiv.classList.add("flex", "flex-col", "items-center", "m-5", "justify-center");
                childrenForm.appendChild(detailDiv);
                palletSerialNumber.disabled = true;
                const childInputId = "childSerialNumber" + i;
                const childLabel = createCustomLabel(childInputId, "Numer childrena " + (i + 1) + ": ");
                const childInput = createCustomInput({
                    id: childInputId, name: "childSerialNumber", value: childUnit, disabled: true,
                });
                detailDiv.append(childLabel, childInput);
                if (goodFlag) {
                    let focusSensor = false;
                    if (powerModuleToChild !== "") {
                        const pmId = "powerModuleSn" + i;
                        const pmLabel = createCustomLabel(pmId, "Numer power module " + (i + 1) + ": ");
                        const pmInput = createCustomInput({
                            id: pmId, name: "powerModuleSn", required: true,
                        });
                        detailDiv.append(pmLabel, pmInput);
                        if (i === 0) {
                            pmInput.focus();
                        }
                    } else {
                        focusSensor = true;
                    }
                    for (let index = 0; index < sensorQuantity; index++) {
                        const sensorId = `sensorSn_${i}_${index}`;
                        const sensorLabel = createCustomLabel(sensorId, "Numer current sensor " + (index + 1) + ": ");
                        const sensorInput = createCustomInput({
                            id: sensorId, name: "sensorSn", required: true,
                        });
                        detailDiv.append(sensorLabel, sensorInput);
                        if (focusSensor && index === 0 && i === 0) {
                            sensorInput.focus();
                        }
                    }
                }
            }
        } else {
            const detailDiv = document.createElement("div");
            detailDiv.id = "palletFormDiv20";
            detailDiv.setAttribute("name", "palletFormDiv2");
            detailDiv.classList.add("flex", "flex-col", "items-center", "m-5", "justify-center");
            document
                .getElementById("palletForm01")
                .appendChild(detailDiv);
            palletSerialNumber.disabled = true;
            if (goodFlag) {
                let focusSensor = false;
                if (powerModuleToChild !== "") {
                    const pmLabel = createCustomLabel("powerModuleSn0", "Numer power module: ");
                    const pmInput = createCustomInput({
                        id: "powerModuleSn0", name: "powerModuleSn", required: true,
                    });
                    detailDiv.append(pmLabel, pmInput);
                    pmInput.focus();
                } else {
                    focusSensor = true;
                }
                for (let index = 0; index < sensorQuantity; index++) {
                    const sensorId = "sensorSn" + index;
                    const sensorLabel = createCustomLabel(sensorId, "Numer current sensor " + (index + 1) + ": ");
                    const sensorInput = createCustomInput({
                        id: sensorId, name: "sensorSn", required: true,
                    });
                    detailDiv.append(sensorLabel, sensorInput);
                    if (focusSensor && index === 0) {
                        sensorInput.focus();
                    }
                }
            }
        }
        if (goodFlag) {
            inputs = Array.from(document.querySelectorAll('input[name="powerModuleSn"], ' + 'input[name="sensorSn"]')).filter((input) => !input.disabled);
            for (const input of inputs) {
                if (input.dataset.validationListenerAttached === "1") {
                    continue;
                }
                input.dataset.validationListenerAttached = "1";
                input.addEventListener("keydown", async (keyEvent) => {
                    if (keyEvent.key !== "Enter") {
                        return;
                    }
                    keyEvent.preventDefault();
                    if (!String(input.value || "").trim()) {
                        return;
                    }
                    let bad = 0;
                    let duplicate;
                    let msg = "";
                    const inputReview = await unitReview(input.value);
                    if (!inputReview.status) {
                        input.value = "";
                        return;
                    }
                    input.value = inputReview.data;
                    if (input.name === "powerModuleSn") {
                        fd.set("unitSerialNumber", input.value);
                        const pmStatus = await Get_Unit_Status(fd);
                        if (!pmStatus.status) {
                            const failedUnit = input.value;
                            input.value = "";
                            showError(failedUnit + "<br>" + (pmStatus.message || "Błąd Get_Unit_Status"), 8000);
                            return;
                        }
                        const pmUnitStatus = await unitCheck(fd);
                        const parentStatus = await parentCheck(fd);
                        if (isRouterTransportFailure(parentStatus)) {
                            const failedUnit = input.value;
                            input.value = "";
                            showRouterTransportError("sprawdzania linku Power Module", parentStatus, failedUnit);
                            return;
                        }
                        if (!parentStatus?.status && !isExpectedMissingParent(parentStatus)) {
                            const failedUnit = input.value;
                            input.value = "";
                            showError(failedUnit + "<br>FIS nie potwierdził braku linku Power Module.<br>" + (parentStatus?.message || "Brak kodu NO_PARENT"), 8000,);
                            return;
                        }
                        duplicate = hasDuplicateValues('input[name="powerModuleSn"]');
                        if (!pmUnitStatus.status) {
                            bad = 1;
                            msg = pmUnitStatus.message;
                        } else if (pmStatus.data.uk2 != powerModuleToChild) {
                            bad = 1;
                            msg = "Part Number Power Module nie pasuje do konfiguracji!<br>" + input.value;
                        } else if (duplicate) {
                            bad = 1;
                            msg = "Użyty ten sam numer power module!<br>" + input.value;
                        } else if (parentStatus.status) {
                            bad = 1;
                            msg = "Power Module jest już zlinkowany!<br>" + input.value;
                        }
                    } else if (input.name === "sensorSn") {
                        const lastPn = input.value.slice(-11);
                        duplicate = hasDuplicateValues('input[name="sensorSn"]');
                        if (sensorPn != lastPn) {
                            bad = 1;
                            msg = "Part Number Sensora LEM nie pasuje do konfiguracji!<br>" + input.value;
                        } else if (duplicate) {
                            bad = 1;
                            msg = "Użyty ten sam numer current sensor!<br>" + input.value;
                        }
                    }
                    if (bad === 1) {
                        input.value = "";
                        showError(msg, 6000);
                        return;
                    }
                    await focusNext(powerSensCheck);
                });
            }
        }
        unitSerialNumber.disabled = true;
        let dc = "COMMENT|" + unitSerialNumberValue + "|PALLET|" + palletSerialNumberValue;
        fd.set("station", station);
        fd.set("dc", dc);
        const manualInputs = Array.from(document.querySelectorAll('input[name="powerModuleSn"], ' + 'input[name="sensorSn"]')).filter((input) => !input.disabled);
        const firstEmptyManual = manualInputs.find((input) => String(input.value || "").trim() === "");
        if (firstEmptyManual) {
            firstEmptyManual.focus();
            return;
        }
        const childrenElements = document.querySelectorAll('input[name="childSerialNumber"]');
        if (childrenElements.length > 0) {
            for (const element of childrenElements) {
                const childUnit = String(element.value || "")
                    .trim()
                    .toUpperCase();
                dc += "|CHILD|" + childUnit;
                fd.set("unit", childUnit);
                fd.set("dc", dc);
                const childEntry = await dataEntry(fd);
                console.log("dataEntry child:", childUnit, childEntry);
                if (!childEntry?.status) {
                    const failure = formatFisWriteFailure("Błąd zapisu dla childrena!<br>" + childUnit + "<br>" + (childEntry?.message || "Brak szczegółów"), childEntry, fisWritesCompleted,);
                    showError(failure.message, failure.requiresReview ? 15000 : 8000);
                    if (!failure.requiresReview) {
                        unitSerialNumber.disabled = false;
                        unitSerialNumber.focus();
                    }
                    return;
                }
                fisWritesCompleted++;
            }
        } else {
            dc += "|GOOD|";
        }
        fd.set("unit", unitSerialNumberValue);
        fd.set("dc", dc);
        console.log("DEBUG: final dc=", dc, "unit=", unitSerialNumberValue);
        const dataEntryStatus = await dataEntry(fd);
        console.log("DEBUG: dataEntry status=", dataEntryStatus);
        if (!dataEntryStatus.status) {
            const failure = formatFisWriteFailure("Błąd zapisu!<br>" + unitSerialNumberValue + "<br>" + (dataEntryStatus.message || "Skontaktuj się z inżynierem lub IT"), dataEntryStatus, fisWritesCompleted,);
            showError(failure.message, failure.requiresReview ? 15000 : 8000);
            if (!failure.requiresReview) {
                unitSerialNumber.disabled = false;
                unitSerialNumber.focus();
            }
            console.error(dataEntryStatus);
            return;
        }
        fisWritesCompleted++;
        fd.set("palletSerialNumber", palletSerialNumberValue);
        const palletEntryResult = await palletEntry(fd);
        console.log("DEBUG: palletEntry result=", palletEntryResult);
        if (!palletEntryResult.status) {
            showPendingCycleError(palletEntryResult);
            return;
        }
        if (Number(document.getElementById("palletSerialNumber").dataset.vacuum_check) === 1) {
            document.getElementById("palletSerialNumber").dataset.vacuum_check = 0;
        }
        showSuccess(palletSerialNumberValue + " Proces poprawny dla:<br>" + unitSerialNumberValue + cycleReplayNotice(palletEntryResult), 3000, () => {
            resetProcessForms();
        },);
    } catch (error) {
        console.error("unitHandler error:", error);
        const requiresReview = fisWritesCompleted > 0;
        const suffix = requiresReview ? "<br>Stan procesu w FIS może być częściowo zapisany. Nie ponawiaj operacji i skontaktuj się z inżynierem lub IT." : "";
        showError(unitSerialNumberValue + "<br>Nieoczekiwany błąd obsługi sztuki!<br>" + (error?.message || "Brak szczegółów błędu") + suffix, requiresReview ? 15000 : 8000,);
        if (!requiresReview) {
            unitSerialNumber.disabled = false;
            unitSerialNumber.focus();
        }
    }
}

async function unitHandler2(form, event) {
    if (event) {
        event.preventDefault();
    }
    const unitSerialNumber = form.unitSerialNumber;
    const scannedUnit = String(unitSerialNumber?.value || "")
        .trim()
        .toUpperCase();
    const review = await unitReview(scannedUnit);
    console.log("unitHandler2 review:", review);
    if (!review?.status) {
        unitSerialNumber.value = "";
        unitSerialNumber.focus();
        return;
    }
    unitSerialNumber.value = review.data;
    unitSerialNumberValue = review.data;
    if (hasDuplicateRootValue(unitSerialNumber, unitSerialNumberValue)) {
        const duplicateUnit = unitSerialNumberValue;
        unitSerialNumber.value = "";
        unitSerialNumber.focus();
        showError(duplicateUnit + "<br>Użyty ten sam numer!", 6000);
        return;
    }
    try {
        const fd = new FormData();
        fd.set("process", process);
        fd.set("unitSerialNumber", unitSerialNumberValue);
        const unitStatus = await unitCheck(fd);
        console.log("unitHandler2 unitStatus:", unitStatus);
        if (!unitStatus?.status) {
            const failedUnit = unitSerialNumberValue;
            unitSerialNumber.value = "";
            unitSerialNumber.focus();
            showError(failedUnit + "<br>" + (unitStatus?.message || "Błąd unitCheck"), 8000);
            return;
        }
        goodFlag = 0;
        powerModuleToChild = "";
        sensorQuantity = 0;
        sensorPn = "";
        const response = await Get_Unit_Status(fd);
        console.log("unitHandler2 Get_Unit_Status:", response);
        if (!response?.status) {
            const failedUnit = unitSerialNumberValue;
            unitSerialNumber.value = "";
            unitSerialNumber.focus();
            showError(failedUnit + "<br>" + (response?.message || "Błąd Get_Unit_Status"), 8000);
            return;
        }
        const componentConfig = resolveComponentConfig(response.data?.uk2);
        if (componentConfig) {
            goodFlag = 1;
            powerModuleToChild = componentConfig.powerModulePartNumber;
            sensorQuantity = componentConfig.sensorQuantity;
            sensorPn = componentConfig.sensorPartNumber;
        }
        let processHousing = response.data?.uk3 === "HOUSING" ? 1 : 0;
        const unitParent = await parentCheck(fd);
        console.log("unitHandler2 unitParent:", unitParent);
        if (isRouterTransportFailure(unitParent)) {
            unitSerialNumber.value = "";
            unitSerialNumber.disabled = false;
            unitSerialNumber.focus();
            showRouterTransportError("sprawdzania parenta", unitParent, unitSerialNumberValue);
            return;
        }
        if (!unitParent?.status && !isExpectedMissingParent(unitParent)) {
            const failedUnit = unitSerialNumberValue;
            unitSerialNumber.value = "";
            unitSerialNumber.disabled = false;
            unitSerialNumber.focus();
            showError(failedUnit + "<br>FIS zwrócił niejednoznaczny wynik sprawdzania parenta.<br>" + (unitParent?.message || "Brak kodu NO_PARENT"), 8000,);
            return;
        }
        if (unitParent?.status && unitParent.data?.startsWith?.("_ARRAY")) {
            processHousing = 1;
        }
        if (unitParent?.status && processHousing === 0) {
            fd.set("unitSerialNumber", unitParent.data);
            const parentStatus = await unitCheck(fd);
            if (!parentStatus?.status) {
                unitSerialNumber.value = "";
                unitSerialNumber.disabled = false;
                unitSerialNumber.focus();
                showError("Parent niegotowy na process!<br>" + unitParent.data + "<br>" + (parentStatus?.message || unitParent?.message || "Brak szczegółów"), 8000);
                return;
            }
            unitSerialNumber.value = parentStatus.data || unitParent.data;
            unitSerialNumberValue = unitSerialNumber.value;
            fd.set("unitSerialNumber", unitSerialNumberValue);
            if (hasDuplicateRootValue(unitSerialNumber, unitSerialNumberValue)) {
                const duplicateUnit = unitSerialNumberValue;
                unitSerialNumber.value = "";
                unitSerialNumber.disabled = false;
                unitSerialNumber.focus();
                showError(duplicateUnit + "<br>Ten sam parent został już użyty w innym gnieździe!", 8000);
                return;
            }
        }
        const unitChildren = await childrenCheck(fd);
        console.log("unitHandler2 unitChildren:", unitChildren);
        if (!unitChildren?.status) {
            showError(unitSerialNumberValue + "<br>" + (unitChildren?.message || "Błąd pobierania childrenów"), 8000);
            return;
        }
        let childrenData = Array.isArray(unitChildren.data) ? [...unitChildren.data] : [];
        if (childrenData.length === 1) {
            fd.set("unitSerialNumber", childrenData[0]);
            const childStatusResponse = await Get_Unit_Status(fd);
            if (!childStatusResponse?.status) {
                showError(childrenData[0] + "<br>" + (childStatusResponse?.message || "Błąd pobierania statusu childrena"), 8000);
                return;
            }
            if (childStatusResponse.data?.uk3 === "HEATSINK") {
                childrenData = [];
            }
            fd.set("unitSerialNumber", unitSerialNumberValue);
        }
        form.querySelectorAll('[data-generated="unitHandler2"]').forEach((element) => {
            element.remove();
        });
        if (childrenData.length > 0 && processHousing === 0) {
            const childrenContainer = document.createElement("div");
            childrenContainer.id = form.id + "_children";
            childrenContainer.dataset.generated = "unitHandler2";
            childrenContainer.classList.add("flex", "justify-center", "items-center", "mt-3", "flex-row");
            form.appendChild(childrenContainer);
            for (let i = 0; i < childrenData.length; i++) {
                const childUnit = String(childrenData[i] || "")
                    .trim()
                    .toUpperCase();
                fd.set("unitSerialNumber", childUnit);
                const childCheck = await unitCheck(fd);
                if (!childCheck?.status) {
                    unitSerialNumber.value = "";
                    unitSerialNumber.disabled = false;
                    unitSerialNumber.focus();
                    showError(childUnit + "<br>" + (childCheck?.message || "Child niegotowy na process"), 8000);
                    return;
                }
                const detailDiv = document.createElement("div");
                detailDiv.id = `${form.id}_Div_${i}`;
                detailDiv.setAttribute("name", "palletFormDiv2");
                detailDiv.dataset.generated = "unitHandler2";
                detailDiv.classList.add("flex", "flex-col", "items-center", "justify-center");
                childrenContainer.appendChild(detailDiv);
                const childId = `childSerialNumber_${form.id}_${i}`;
                const childLabel = createCustomLabel(childId, "Numer childrena " + (i + 1) + ": ");
                const childInput = createCustomInput({
                    id: childId, name: "childSerialNumber", value: childUnit, disabled: true,
                });
                detailDiv.append(childLabel, childInput);
                if (goodFlag) {
                    let firstManualInput = null;
                    if (powerModuleToChild !== "") {
                        const pmId = `powerModuleSn_${form.id}_${i}`;
                        const pmLabel = createCustomLabel(pmId, "Numer power module " + (i + 1) + ": ");
                        const pmInput = createCustomInput({
                            id: pmId, name: "powerModuleSn", required: true,
                        });
                        pmInput.dataset.expectedPartNumber = powerModuleToChild;
                        detailDiv.append(pmLabel, pmInput);
                        firstManualInput = pmInput;
                    }
                    for (let index = 0; index < sensorQuantity; index++) {
                        const sensorId = `sensorSn_${form.id}_${i}_${index}`;
                        const sensorLabel = createCustomLabel(sensorId, "Numer current sensor " + (index + 1) + ": ");
                        const sensorInput = createCustomInput({
                            id: sensorId, name: "sensorSn", required: true,
                        });
                        sensorInput.dataset.expectedPartNumber = sensorPn;
                        detailDiv.append(sensorLabel, sensorInput);
                        if (!firstManualInput) {
                            firstManualInput = sensorInput;
                        }
                    }
                    if (i === 0 && firstManualInput) {
                        firstManualInput.focus();
                    }
                }
            }
        } else {
            const detailDiv = document.createElement("div");
            detailDiv.id = `${form.id}_Div20`;
            detailDiv.setAttribute("name", "palletFormDiv2");
            detailDiv.dataset.generated = "unitHandler2";
            detailDiv.classList.add("flex", "flex-col", "items-center", "justify-center");
            form.appendChild(detailDiv);
            if (goodFlag) {
                let firstManualInput = null;
                if (powerModuleToChild !== "") {
                    const pmId = `powerModuleSn_${form.id}`;
                    const pmLabel = createCustomLabel(pmId, "Numer power module: ");
                    const pmInput = createCustomInput({
                        id: pmId, name: "powerModuleSn", required: true,
                    });
                    pmInput.dataset.expectedPartNumber = powerModuleToChild;
                    detailDiv.append(pmLabel, pmInput);
                    firstManualInput = pmInput;
                }
                for (let index = 0; index < sensorQuantity; index++) {
                    const sensorId = `sensorSn_${form.id}_${index}`;
                    const sensorLabel = createCustomLabel(sensorId, "Numer current sensor " + (index + 1) + ": ");
                    const sensorInput = createCustomInput({
                        id: sensorId, name: "sensorSn", required: true,
                    });
                    sensorInput.dataset.expectedPartNumber = sensorPn;
                    detailDiv.append(sensorLabel, sensorInput);
                    if (!firstManualInput) {
                        firstManualInput = sensorInput;
                    }
                }
                if (firstManualInput) {
                    firstManualInput.focus();
                }
            }
        }
        palletSerialNumber.disabled = true;
        unitSerialNumber.disabled = true;
        inputs = [...document.querySelectorAll('#childDiv input:not([disabled]):not([id="themeToggle"])'),];
        const manualInputs = inputs.filter((input) => input.name === "powerModuleSn" || input.name === "sensorSn");
        for (const input of manualInputs) {
            if (input.dataset.validationListenerAttached === "1") {
                continue;
            }
            input.dataset.validationListenerAttached = "1";
            input.addEventListener("keydown", async (keyEvent) => {
                if (keyEvent.key !== "Enter") {
                    return;
                }
                keyEvent.preventDefault();
                if (!String(input.value || "").trim()) {
                    return;
                }
                let bad = 0;
                let duplicate = false;
                let msg = "";
                const inputReview = await unitReview(input.value);
                console.log("manual input review:", inputReview);
                if (!inputReview?.status) {
                    input.value = "";
                    return;
                }
                input.value = inputReview.data;
                if (input.name === "powerModuleSn") {
                    fd.set("unitSerialNumber", input.value);
                    const pmUnitStatus = await unitCheck(fd);
                    const pmStatusResponse = await Get_Unit_Status(fd);
                    const parentStatus = await parentCheck(fd);
                    if (isRouterTransportFailure(parentStatus)) {
                        msg = parentStatus?.message || "Błąd komunikacji podczas sprawdzania linku Power Module";
                        bad = 1;
                    } else if (!parentStatus?.status && !isExpectedMissingParent(parentStatus)) {
                        msg = parentStatus?.message || "FIS nie potwierdził braku linku Power Module (brak kodu NO_PARENT)";
                        bad = 1;
                    } else if (!pmStatusResponse?.status) {
                        msg = pmStatusResponse?.message || "Błąd Get_Unit_Status dla Power Module";
                        bad = 1;
                    } else {
                        duplicate = hasDuplicateValues('input[name="powerModuleSn"]');
                    }
                    if (!bad && !pmUnitStatus?.status) {
                        msg = pmUnitStatus?.message || "Power Module niegotowy na process";
                        bad = 1;
                    } else if (!bad && pmStatusResponse.data?.uk2 != input.dataset.expectedPartNumber) {
                        bad = 1;
                        msg = "Part Number Power Module nie pasuje do konfiguracji!<br>" + input.value;
                    } else if (!bad && duplicate) {
                        bad = 1;
                        msg = "Użyty ten sam numer power module!<br>" + input.value;
                    } else if (!bad && parentStatus?.status) {
                        bad = 1;
                        msg = "Power Module jest już zlinkowany!<br>" + input.value;
                    }
                } else if (input.name === "sensorSn") {
                    const lastPn = String(input.value || "").slice(-11);
                    duplicate = hasDuplicateValues('input[name="sensorSn"]');
                    if (input.dataset.expectedPartNumber != lastPn) {
                        bad = 1;
                        msg = "Part Number Sensora LEM nie pasuje do konfiguracji!<br>" + input.value;
                    } else if (duplicate) {
                        bad = 1;
                        msg = "Użyty ten sam numer current sensor!<br>" + input.value;
                    }
                }
                if (bad === 1) {
                    const failedValue = input.value;
                    input.value = "";
                    showError(msg || failedValue + "<br>Błąd walidacji", 6000);
                    return;
                }
                inputs = [...document.querySelectorAll('#childDiv input:not([disabled]):not([id="themeToggle"])'),];
                await focusNext(dataEntryFunc);
            });
        }
        const currentManualInputs = Array.from(form.querySelectorAll('input[name="powerModuleSn"], ' + 'input[name="sensorSn"]')).filter((input) => !input.disabled);
        if (currentManualInputs.length === 0) {
            inputs = [...document.querySelectorAll('#childDiv input:not([disabled]):not([id="themeToggle"])'),];
            const firstEmpty = inputs.find((input) => String(input.value || "").trim() === "");
            if (firstEmpty) {
                firstEmpty.focus();
            } else {
                await dataEntryFunc();
            }
        }
    } catch (error) {
        console.error("unitHandler2 error:", error);
        showError((unitSerialNumberValue || scannedUnit) + "<br>Nieoczekiwany błąd obsługi sztuki!<br>" + (error?.message || "Brak szczegółów błędu"), 8000);
    }
}
