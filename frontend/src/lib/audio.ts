// Web Audio API feedback utility for shop floor / operator station interactions

let audioContext: AudioContext | null = null;

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

/**
 * Plays a pleasant high tone indicating a successful scan.
 */
export function playScanSuccessSound(): void {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08); // E6

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
    } catch {
        // Silently ignore audio playback errors
    }
}

/**
 * Plays a low double warning buzzer indicating an error or blocked pallet.
 */
export function playScanErrorSound(): void {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime;
        // First buzz
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(220, now);
        gain1.gain.setValueAtTime(0.15, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.1);

        // Second buzz
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(180, now + 0.12);
        gain2.gain.setValueAtTime(0.15, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.25);
    } catch {
        // Silently ignore audio playback errors
    }
}

export function prepareScanAudio() { getAudioContext(); }
