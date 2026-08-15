/**
 * Background persistence and application: the uploaded photo is downscaled
 * to a JPEG data URL, stored in localStorage (survives reloads), and applied
 * to the document body. The injected global style (client/index.ts) turns
 * the page-level surfaces transparent when `data-dsh-bg` is present, so the
 * image shows through the main area while the sidebar keeps its own fill.
 *
 * @module @deepseek-ai/dsh-client-ui-background/client
 */
/** localStorage key holding the applied background's data URL. */
export declare const BACKGROUND_STORAGE_KEY = "dsh.background.image";
/** <style> element id of the injected background rule. */
export declare const BACKGROUND_STYLE_ID = "dsh-background-style";
/** Downscale target: images wider than this are shrunk (long side kept). */
export declare const DEFAULT_MAX_WIDTH = 1920;
/** JPEG quality for the stored data URL. */
export declare const DEFAULT_QUALITY = 0.82;
/**
 * The currently stored background data URL.
 * @returns the data URL, or null when none is stored.
 */
export declare function loadBackground(): string | null;
/** Store a background data URL. @param url - the image data URL to persist. */
export declare function saveBackground(url: string): void;
/** Remove the stored background. */
export declare function clearBackground(): void;
/**
 * Apply a background image to the document body: marks `data-dsh-bg` and
 * publishes the image through the `--dsh-bg-url` custom property, which the
 * injected style consumes.
 * @param url - image data URL (or any URL the browser can paint).
 */
export declare function applyBackground(url: string): void;
/** Remove the applied background from the body (the stored image stays). */
export declare function clearAppliedBackground(): void;
/** Whether a background is currently applied to the body. */
export declare function isBackgroundApplied(): boolean;
/**
 * Downscale and encode an image file into a JPEG data URL. The image is
 * loaded through an <img>, drawn onto a canvas capped at `maxWidth`, and
 * exported; files already narrower than the cap keep their width. Binary
 * (non-image) files and decode failures reject.
 * @param file - the picked image file.
 * @param maxWidth - long-side cap for the stored image.
 * @param quality - JPEG quality passed to `canvas.toDataURL`.
 * @returns the data URL.
 */
export declare function encodeImage(file: File, maxWidth?: number, quality?: number): Promise<string>;
//# sourceMappingURL=background.d.ts.map