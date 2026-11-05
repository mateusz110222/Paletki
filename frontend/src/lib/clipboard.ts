export async function copyText(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }

        // shortcut: HTTP requires legacy execCommand; remove after switching to HTTPS.
        const previousFocus = document.activeElement as HTMLElement | null;
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.readOnly = true;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
        try {
            document.body.appendChild(textarea);
            textarea.focus({ preventScroll: true });
            textarea.select();
            return document.execCommand('copy');
        } finally {
            textarea.remove();
            previousFocus?.focus({ preventScroll: true });
        }
    } catch {
        return false;
    }
}
