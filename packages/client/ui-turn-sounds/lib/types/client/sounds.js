/**
 * Sound settings persistence and browser audio playback for the turn-sounds
 * plugin. Settings live in localStorage so custom uploads stay in the browser;
 * default sounds are synthesized with Web Audio (no audio files shipped).
 *
 * @module @deepseek-ai/dsh-client-ui-turn-sounds/client/sounds
 */
const STORAGE_KEY = 'dsh.turn-sounds';
/** Default settings: sounds on, 70% volume, built-in chimes. */
export const DEFAULT_SETTINGS = {
    enabled: true,
    volume: 0.7,
    completion: { mode: 'default' },
    question: { mode: 'default' },
};
function isSoundChoice(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const choice = value;
    return choice.mode === 'default' || choice.mode === 'custom';
}
function parseSettings(raw) {
    if (raw === null)
        return DEFAULT_SETTINGS;
    try {
        const value = JSON.parse(raw);
        return {
            enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.enabled,
            volume: typeof value.volume === 'number' && value.volume >= 0 && value.volume <= 1
                ? value.volume
                : DEFAULT_SETTINGS.volume,
            completion: isSoundChoice(value.completion) ? value.completion : DEFAULT_SETTINGS.completion,
            question: isSoundChoice(value.question) ? value.question : DEFAULT_SETTINGS.question,
        };
    }
    catch {
        return DEFAULT_SETTINGS;
    }
}
/** Read the persisted sound settings, falling back to defaults. */
export function loadSettings() {
    if (typeof localStorage === 'undefined')
        return DEFAULT_SETTINGS;
    return parseSettings(localStorage.getItem(STORAGE_KEY));
}
/** Persist sound settings to localStorage. */
export function saveSettings(settings) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    catch {
        // Storage failures (private mode, quota) only disable persistence.
    }
}
let audioContext;
function ensureAudioContext() {
    if (typeof window === 'undefined')
        return undefined;
    const w = window;
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (Ctor === undefined)
        return undefined;
    if (audioContext === undefined)
        audioContext = new Ctor();
    if (audioContext.state === 'suspended')
        void audioContext.resume();
    return audioContext;
}
/** Resume the audio context on the first user gesture (autoplay policy). */
export function primeAudioOnInteraction() {
    if (typeof window === 'undefined')
        return;
    const resume = () => {
        void ensureAudioContext()?.resume();
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
}
function playTone(context, frequency, startAt, duration, volume) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
}
function playDefault(kind, volume) {
    const context = ensureAudioContext();
    if (context === undefined)
        return;
    const now = context.currentTime + 0.01;
    if (kind === 'completion') {
        playTone(context, 660, now, 0.18, volume);
        playTone(context, 880, now + 0.15, 0.22, volume);
    }
    else {
        playTone(context, 520, now, 0.18, volume);
        playTone(context, 390, now + 0.15, 0.24, volume);
    }
}
function playCustom(dataUrl, volume) {
    const audio = new Audio(dataUrl);
    audio.volume = Math.max(0, Math.min(1, volume));
    void audio.play().catch(() => undefined);
}
/** Play the configured sound for one event kind. */
export function playSound(kind, settings) {
    if (!settings.enabled || settings.volume <= 0)
        return;
    const choice = kind === 'completion' ? settings.completion : settings.question;
    if (choice.mode === 'custom' && choice.customDataUrl !== undefined) {
        playCustom(choice.customDataUrl, settings.volume);
    }
    else {
        playDefault(kind, settings.volume);
    }
}
//# sourceMappingURL=sounds.js.map