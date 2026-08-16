/**
 * Minimal CDP browser automation for headless Microsoft Edge. Launches a
 * background Edge instance, connects over the DevTools WebSocket, and exposes
 * navigate/screenshot/evaluate primitives for the agent's
 * screenshot-analyze-operate loop.
 *
 * @module @deepseek-ai/dsh-tool-browser
 */
import { type ChildProcess } from 'node:child_process';
/** One live headless browser owned by one agent session. */
export interface BrowserSession {
    readonly id: string;
    readonly process: ChildProcess;
    readonly ws: WebSocket;
    readonly port: number;
    readonly userDataDir: string;
    readonly targetId: string;
}
/** Launch headless Edge, open the URL, and return a connected session. */
export declare function openBrowser(url: string, headless: boolean): Promise<BrowserSession>;
/** Capture the current page as a PNG file. */
export declare function screenshotPage(session: BrowserSession, outputPath: string): Promise<{
    path: string;
    bytes: number;
}>;
/** Evaluate a JavaScript expression in the page and return the JSON-safe value. */
export declare function evaluatePage(session: BrowserSession, expression: string): Promise<{
    ok: boolean;
    result?: unknown;
    error?: string;
}>;
/** Close the browser, kill the child process, and remove its profile. */
export declare function closeBrowser(session: BrowserSession): Promise<void>;
//# sourceMappingURL=browser.d.ts.map