/**
 * Background browser automation tools for the screenshot-analyze-operate
 * loop. Uses headless Microsoft Edge over CDP so the browser never steals the
 * foreground from the user's current application.
 *
 * @module @deepseek-ai/dsh-tool-browser
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "tool-browser";
/** Services required by the browser tools. */
export declare const inject: string[];
/**
 * Register the browser tools.
 * @param ctx - plugin context carrying the tools registry.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map