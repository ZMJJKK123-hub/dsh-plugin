/**
 * Screenshot command construction and execution. The tool captures the screen
 * through the shell capability seam so the same sandbox policy applies as for
 * `tool-pwsh`; the saved PNG path is then available to an external vision MCP
 * tool (`mcp__glm4v__analyze_image`) for the agent's own image-recognition loop.
 *
 * @module @deepseek-ai/dsh-tool-screenshot
 */
import type { Context } from '@deepseek-ai/cordis';
/** Tool input for one screenshot capture. */
export interface ScreenshotOptions {
    /** Absolute or workspace-relative PNG path; defaults to the OS temp directory. */
    readonly outputPath?: string | undefined;
    /** Capture region as `x,y,w,h` in pixels; defaults to the full virtual screen. */
    readonly region?: string | undefined;
}
/** Canonical screenshot result returned to the model. */
export interface ScreenshotResult {
    readonly path: string;
    readonly bytes: number;
}
/** Default screenshot path: a timestamped PNG in the OS temp directory. */
export declare function defaultScreenshotPath(): string;
/**
 * Build the platform-specific shell command that captures the screen to a PNG.
 * @param platform - Node.js platform identifier.
 * @param outputPath - absolute PNG path to write.
 * @param region - optional `x,y,w,h` capture region.
 * @returns the shell command string.
 */
export declare function screenshotCommand(platform: NodeJS.Platform, outputPath: string, region?: string): string;
/**
 * Capture the screen through `ctx.shell`, then stat the resulting PNG through
 * `ctx.fs` so the returned size is a harness-observed fact.
 * @param ctx - plugin context with shell and filesystem services.
 * @param options - output path and optional region.
 * @param signal - abort signal forwarded to shell and filesystem calls.
 * @returns the saved PNG path and byte size.
 */
export declare function takeScreenshot(ctx: Context, options: ScreenshotOptions, signal: AbortSignal | undefined): Promise<ScreenshotResult>;
//# sourceMappingURL=screenshot.d.ts.map