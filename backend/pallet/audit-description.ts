import {AuditLog} from "../shared/types";
import type {AuditLogRecord} from "./models";
import {SupportedLanguage, t, TranslationKey} from "../shared/i18n";

const PREFIX = "i18n:";

interface EncodedAuditDescription {
    key: TranslationKey;
    variables?: Record<string, string | number>;
    comment?: string;
    changes?: Array<{
        key: TranslationKey;
        variables: Record<string, string | number>;
    }>;
}

export function encodeAuditChanges(
    changes: NonNullable<EncodedAuditDescription["changes"]>,
): string {
    return PREFIX + JSON.stringify({key: "audit_updated", changes} satisfies EncodedAuditDescription);
}

export function encodeAuditDescription(
    key: TranslationKey,
    variables: Record<string, string | number> = {},
    comment?: string | null,
): string {
    return PREFIX + JSON.stringify({
        key,
        variables,
        ...(comment?.trim() ? {comment: comment.trim()} : {}),
    } satisfies EncodedAuditDescription);
}

export function localizeAuditDescription(description: string, lang?: SupportedLanguage | string | null): string {
    if (!description.startsWith(PREFIX)) return description;

    try {
        const encoded = JSON.parse(description.slice(PREFIX.length)) as EncodedAuditDescription;
        const variables = encoded.changes
            ? {changes: encoded.changes.map((change) => t(change.key, lang, change.variables)).join(", ")}
            : encoded.variables;
        const translated = t(encoded.key, lang, variables);
        return encoded.comment ? `${translated}: ${encoded.comment}` : translated;
    } catch {
        return description;
    }
}

export function localizeAuditLog(log: AuditLogRecord, lang?: SupportedLanguage | string | null): AuditLog {
    const operatorId = log.operator_id === "System_AutoBlock"
        ? t("system_auto_block_operator", lang)
        : log.operator_id === "System"
            ? t("system_operator", lang)
            : log.operator_id;

    let encoded: EncodedAuditDescription | undefined;
    if (log.description.startsWith(PREFIX)) {
        try {encoded = JSON.parse(log.description.slice(PREFIX.length));} catch { /* Legacy plain text. */ }
    }
    const isUnblock = encoded?.key === 'audit_unblocked' || encoded?.key === 'audit_unblocked_cycle_limit';
    return {
        ...log,
        event_kind: isUnblock ? 'unblock' : encoded?.key === 'audit_updated' || encoded?.key === 'audit_edited' ? 'update' : log.previous_status !== log.new_status ? 'status' : 'update',
        ...(isUnblock && encoded?.comment ? {comment: encoded.comment} : {}),
        timestamp: log.timestamp.toISOString(),
        operator_id: operatorId,
        description: isUnblock ? t("audit_unblocked", lang) : localizeAuditDescription(log.description, lang),
    };
}
