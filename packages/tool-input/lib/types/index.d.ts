/**
 * Human-hand input simulation tools: mouse trajectory/click/scroll and
 * keyboard input. Execution goes through the `ctx.shell` capability seam with
 * a full-access sandbox policy because real desktop input requires the same
 * desktop/display access as `tool-screenshot`.
 *
 * @module @deepseek-ai/dsh-tool-input
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "tool-input";
/** Services required by the input tools. */
export declare const inject: string[];
/**
 * Register the input simulation tools.
 * @param ctx - plugin context carrying tools and shell services.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map