// Web Audio API feedback utility for shop floor / operator station interactions

export type AudioVolumeLevel = 'low' | 'normal' | 'loud';
export type SoundToneType = 'success' | 'warning' | 'error';

const VOLUME_STORAGE_KEY = 'palletx.scan-volume';

let volumeLevel: AudioVolumeLevel | undefined;
let audioContext: AudioContext | null = null;
let hasRegisteredUnlockListeners = false;
const soundListeners = new Set<(tone: SoundToneType) => void>();

export function getAudioVolumeLevel(): AudioVolumeLevel {
    if (volumeLevel !== undefined) return volumeLevel;
    if (typeof window === 'undefined') return 'normal';
    try {
        const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
        if (stored === 'low' || stored === 'normal' || stored === 'loud') {
            volumeLevel = stored;
            return volumeLevel;
        }
    } catch {
        // ignore
    }
    volumeLevel = 'normal';
    return volumeLevel;
}

export function setAudioVolumeLevel(level: AudioVolumeLevel): void {
    volumeLevel = level;
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(VOLUME_STORAGE_KEY, level);
    } catch {
        // ignore
    }
}

export function getVolumeMultiplier(level: AudioVolumeLevel = getAudioVolumeLevel()): number {
    switch (level) {
        case 'low':
            return 0.5;
        case 'loud':
            return 2.0;
        case 'normal':
        default:
            return 1.0;
    }
}

export function addSoundListener(listener: (tone: SoundToneType) => void): () => void {
    soundListeners.add(listener);
    return () => {
        soundListeners.delete(listener);
    };
}

function notifySoundPlayed(tone: SoundToneType): void {
    soundListeners.forEach((listener) => {
        try {
            listener(tone);
        } catch {
            // ignore
        }
    });
}

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
        if (!audioContext || audioContext.state === 'closed') {
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

function getRunningAudioContext(): AudioContext | null {
    const ctx = getAudioContext();
    // A scan signal is only useful now. Never queue it behind an autoplay prompt
    // or a suspended tab and replay stale feedback on a later user gesture.
    return ctx?.state === 'running' ? ctx : null;
}

/**
 * Plays a pleasant ascending high tone indicating a successful scan of a healthy pallet.
 */
export async function playScanSuccessSound(): Promise<void> {
    const ctx = getRunningAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime + 0.01;
        const mult = getVolumeMultiplier();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08); // E6

        gain.gain.setValueAtTime(0.24 * mult, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
        notifySoundPlayed('success');
    } catch {
        // Silently ignore audio playback errors
    }
}

/**
 * Plays a distinct two-tone alert chime indicating a pallet requiring attention
 * (e.g. damaged, washing required, or cycle limit reached).
 */
export async function playScanWarningSound(): Promise<void> {
    const ctx = getRunningAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime + 0.01;
        const mult = getVolumeMultiplier();

        // Tone 1: 587 Hz (D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(587, now);
        gain1.gain.setValueAtTime(0.22 * mult, now);
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
        gain2.gain.setValueAtTime(0.22 * mult, now + 0.14);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.14);
        osc2.stop(now + 0.28);
        notifySoundPlayed('warning');
    } catch {
        // Silently ignore audio playback errors
    }
}

/**
 * Plays a low double warning buzzer indicating an error or blocked pallet.
 */
export async function playScanErrorSound(): Promise<void> {
    const ctx = getRunningAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime + 0.01;
        const mult = getVolumeMultiplier();

        // First buzz
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(220, now);
        gain1.gain.setValueAtTime(0.25 * mult, now);
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
        gain2.gain.setValueAtTime(0.25 * mult, now + 0.14);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.14);
        osc2.stop(now + 0.28);
        notifySoundPlayed('error');
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
