/**
 * The CUA confirmation gate and capability precheck: the first Computer-Use
 * tool call per session (screenshot or input simulation) asks the user for
 * approval through the approval seam; the decision is cached for the
 * session's lifetime. The capability precheck verifies the platform's
 * screen-capture command works before the first approval ask.
 *
 * @module @dsh-custom/dsh-cua-guard
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "cua-guard";
/** Services required by the guard. */
export declare const inject: string[];
/** The Computer-Use tool names this guard gates. */
export declare const CUA_TOOL_NAMES: readonly ["screenshot", "mouse_click", "mouse_trajectory", "mouse_scroll", "keyboard_input"];
/** Plugin config (all optional — `Config` supplies the defaults). */
export interface Config {
    /** Set false to pass every CUA call through without asking. */
    enabled?: boolean;
    /** Re-ask after this many milliseconds; 0 (default) asks once per session. */
    reaskMs?: number;
}
export declare const Config: z<Config>;
/**
 * The platform's screen-capture availability probe: a shell command that
 * exits 0 when the capture capability exists on this platform.
 */
export declare function captureProbeCommand(platform: NodeJS.Platform): string;
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map