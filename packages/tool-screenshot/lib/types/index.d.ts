/**
 * Model-facing screenshot tool: captures the current screen to a PNG so the
 * agent can recognize its own screenshots through an external vision MCP tool
 * (`mcp__glm4v__analyze_image` / `ocr_image`). Execution goes through the
 * `ctx.shell` capability seam, so the same sandbox policy applies as for other
 * shell-backed tools.
 *
 * @module @deepseek-ai/dsh-tool-screenshot
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "tool-screenshot";
/** Services required by the screenshot tool. */
export declare const inject: string[];
/**
 * Register the `screenshot` tool.
 * @param ctx - plugin context carrying tools, shell, and filesystem services.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map