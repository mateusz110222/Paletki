// Web Audio API feedback utility for shop floor / operator station interactions

let audioContext: AudioContext | null = null;
let hasRegisteredUnlockListeners = false;

/**
 * Registers one-time user gesture listeners (click, pointerdown, keydown, touchstart)
 * to automatically wake up the browser AudioContext without requiring specific hotkeys.
 */
export function initAudioUnlock(): void {
    if (typeof window === 'undefined' || hasRegisteredUnlockListeners) return;
    hasRegisteredUnlockListeners = true;

    const unlock = () => {
        try {
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                void ctx.resume().catch(() => {});
            }
        } catch {
            // Ignore unlock errors
        }
    };

    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    window.addEventListener('click', unlock, { once: true, passive: true });
}

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioContextClass) {
                audioContext = new AudioContextClass();
            }
        }
        if (audioContext && audioContext.state === 'suspended') {
            void audioContext.resume().catch(() => {});
        }
        return audioContext;
    } catch {
        return null;
    }
}

async function ensureActiveAudioContext(): Promise<AudioContext | null> {
    const ctx = getAudioContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch {
            // Ignore resume rejection
        }
    }
    return ctx;
}

/**
 * Plays a pleasant ascending high tone indicating a successful scan of a healthy pallet.
 */
export async function playScanSuccessSound(): Promise<void> {
    const ctx = await ensureActiveAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime + 0.01;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08); // E6

        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
    } catch {
        // Silently ignore audio playback errors
    }
}

/**
 * Plays a distinct two-tone alert chime indicating a pallet requiring attention
 * (e.g. damaged, washing required, or cycle limit reached).
 */
export async function playScanWarningSound(): Promise<void> {
    const ctx = await ensureActiveAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime + 0.01;

        // Tone 1: 587 Hz (D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(587, now);
        gain1.gain.setValueAtTime(0.22, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);

        // Tone 2: 440 Hz (A4)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(440, now + 0.14);
        gain2.gain.setValueAtTime(0.22, now + 0.14);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.14);
        osc2.stop(now + 0.28);
    } catch {
        // Silently ignore audio playback errors
    }
}

/**
 * Plays a low double warning buzzer indicating an error or blocked pallet.
 */
export async function playScanErrorSound(): Promise<void> {
    const ctx = await ensureActiveAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime + 0.01;
        // First buzz
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(220, now);
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);

        // Second buzz
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(180, now + 0.14);
        gain2.gain.setValueAtTime(0.25, now + 0.14);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.14);
        osc2.stop(now + 0.28);
    } catch {
        // Silently ignore audio playback errors
    }
}

export function prepareScanAudio(): void {
    initAudioUnlock();
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
    }
}

