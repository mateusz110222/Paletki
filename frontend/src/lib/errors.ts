export function getErrorMessage(error: unknown, fallback?: string): string {
    if (typeof error === 'string' && error.trim()) {
        return error.trim();
    }
    if (error && typeof error === 'object') {
        const anyErr = error as Record<string, unknown>;
        if (typeof anyErr.message === 'string' && anyErr.message.trim()) {
            return anyErr.message.trim();
        }
        if (typeof anyErr.error === 'string' && anyErr.error.trim()) {
            return anyErr.error.trim();
        }
    }
    return fallback || '';
}
