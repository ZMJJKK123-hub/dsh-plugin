/**
 * Input simulation command construction. Tools run through `ctx.shell` so the
 * same sandbox policy applies as for `tool-screenshot`; the generated commands
 * use an embedded C# helper (user32 SendInput/SetCursorPos) to simulate real
 * mouse and keyboard input on the current Windows desktop.
 *
 * @module @deepseek-ai/dsh-tool-input
 */
/** One screen point in pixels. */
export interface Point {
    readonly x: number;
    readonly y: number;
}
/** Mouse button names accepted by the input helper. */
export type MouseButton = 'left' | 'right' | 'middle';
/** Mouse trajectory terminal action. */
export type MouseAction = 'move' | 'click' | 'double-click' | 'drag';
/** Inputs for the mouse trajectory tool. */
export interface MouseTrajectoryOptions {
    readonly points: readonly Point[];
    readonly durationMs?: number;
    readonly action?: MouseAction;
    readonly button?: MouseButton;
}
/** Inputs for the mouse click tool. */
export interface MouseClickOptions {
    readonly x: number;
    readonly y: number;
    readonly button?: MouseButton;
    readonly clicks?: number;
    readonly durationMs?: number;
}
/** Inputs for the mouse scroll tool. */
export interface MouseScrollOptions {
    readonly delta: number;
    readonly x?: number;
    readonly y?: number;
}
/** Inputs for the keyboard input tool. */
export interface KeyboardInputOptions {
    readonly text?: string;
    readonly keys?: readonly string[];
    readonly delayMs?: number;
}
/**
 * Build the PowerShell command for mouse trajectory movement/click/drag.
 * @param options - trajectory points and terminal action.
 * @returns a PowerShell command string.
 */
export declare function buildMouseTrajectoryCommand(options: MouseTrajectoryOptions): string;
/**
 * Build the PowerShell command for a mouse click at one coordinate.
 * @param options - click coordinate, button, click count, and optional duration.
 * @returns a PowerShell command string.
 */
export declare function buildMouseClickCommand(options: MouseClickOptions): string;
/**
 * Build the PowerShell command for a mouse wheel scroll.
 * @param options - scroll delta and optional target coordinate.
 * @returns a PowerShell command string.
 */
export declare function buildMouseScrollCommand(options: MouseScrollOptions): string;
/**
 * Build the PowerShell command for keyboard text/keys input.
 * @param options - literal text, key combo, and per-key delay.
 * @returns a PowerShell command string.
 */
export declare function buildKeyboardCommand(options: KeyboardInputOptions): string;
//# sourceMappingURL=input.d.ts.map