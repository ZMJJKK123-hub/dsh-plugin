/**
 * Sound settings persistence and browser audio playback for the turn-sounds
 * plugin. Settings live in localStorage so custom uploads stay in the browser;
 * default sounds are synthesized with Web Audio (no audio files shipped).
 *
 * @module @deepseek-ai/dsh-client-ui-turn-sounds/client/sounds
 */
/** One sound slot's choice: a built-in synthesized chime or a user upload. */
export interface SoundChoice {
    readonly mode: 'default' | 'custom';
    /** Display name for a custom upload. */
    readonly customName?: string;
    /** Data URL (mp3/wav/ogg) for a custom upload. */
    readonly customDataUrl?: string;
}
/** Persistent settings for the turn-sounds plugin. */
export interface SoundSettings {
    readonly enabled: boolean;
    /** 0..1 playback volume. */
    readonly volume: number;
    readonly completion: SoundChoice;
    readonly question: SoundChoice;
}
/** Default settings: sounds on, 70% volume, built-in chimes. */
export declare const DEFAULT_SETTINGS: SoundSettings;
/** Read the persisted sound settings, falling back to defaults. */
export declare function loadSettings(): SoundSettings;
/** Persist sound settings to localStorage. */
export declare function saveSettings(settings: SoundSettings): void;
/** Resume the audio context on the first user gesture (autoplay policy). */
export declare function primeAudioOnInteraction(): void;
/** Play the configured sound for one event kind. */
export declare function playSound(kind: 'completion' | 'question', settings: SoundSettings): void;
//# sourceMappingURL=sounds.d.ts.map