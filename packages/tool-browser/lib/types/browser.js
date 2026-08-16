/**
 * Minimal CDP browser automation for headless Microsoft Edge. Launches a
 * background Edge instance, connects over the DevTools WebSocket, and exposes
 * navigate/screenshot/evaluate primitives for the agent's
 * screenshot-analyze-operate loop.
 *
 * @module @deepseek-ai/dsh-tool-browser
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const pending = new Map();
const loadWaiters = new Map();
let nextId = 1;
function delay(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}
function edgeExecutable() {
    const programFiles86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
    const candidates = [
        join(programFiles86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
    const found = candidates.find(path => existsSync(path));
    if (found === undefined) {
        throw new Error('Microsoft Edge was not found on this system');
    }
    return found;
}
async function readDevToolsPort(userDataDir, process) {
    const file = join(userDataDir, 'DevToolsActivePort');
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (process.exitCode !== null)
            throw new Error('Edge exited before the DevTools port was ready');
        try {
            const text = await readFile(file, 'utf8');
            const port = Number(text.split(/\r?\n/)[0]);
            if (Number.isInteger(port) && port > 0)
                return port;
        }
        catch {
            // Port file not written yet; retry.
        }
        await delay(100);
    }
    throw new Error('Timed out waiting for Edge DevTools port');
}
async function findPageTarget(port) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/list`);
            const targets = await response.json();
            const page = targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl !== undefined);
            if (page?.id !== undefined && page.webSocketDebuggerUrl !== undefined) {
                return { id: page.id, webSocketDebuggerUrl: page.webSocketDebuggerUrl };
            }
        }
        catch {
            // DevTools endpoint not ready yet; retry.
        }
        await delay(100);
    }
    throw new Error('Timed out waiting for Edge page target');
}
function cdpSend(session, method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`CDP ${method} timed out`));
        }, 30_000);
        pending.set(id, { resolve, reject, timer });
        session.ws.send(JSON.stringify({ id, method, params }));
    });
}
async function navigateAndWait(session, url) {
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            if (loadWaiters.delete(session.id))
                resolve();
        }, 15_000);
        loadWaiters.set(session.id, () => {
            clearTimeout(timer);
            resolve();
        });
        void cdpSend(session, 'Page.navigate', { url }).catch((error) => {
            clearTimeout(timer);
            loadWaiters.delete(session.id);
            reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
}
/** Launch headless Edge, open the URL, and return a connected session. */
export async function openBrowser(url, headless) {
    const userDataDir = await mkdtemp(join(tmpdir(), 'dsh-browser-'));
    const args = [
        `--user-data-dir=${userDataDir}`,
        '--remote-debugging-port=0',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-features=Translate',
        ...(headless ? ['--headless=new'] : []),
        'about:blank',
    ];
    const child = spawn(edgeExecutable(), args, { stdio: 'ignore', windowsHide: true });
    child.on('error', () => undefined);
    const port = await readDevToolsPort(userDataDir, child);
    const target = await findPageTarget(port);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.onopen = () => { resolve(); };
        ws.onerror = () => { reject(new Error('CDP WebSocket connection failed')); };
    });
    const session = {
        id: randomUUID(),
        process: child,
        ws,
        port,
        userDataDir,
        targetId: target.id,
    };
    ws.onmessage = (event) => {
        let message;
        try {
            message = JSON.parse(String(event.data));
        }
        catch {
            return;
        }
        if (message.id !== undefined && pending.has(message.id)) {
            const call = pending.get(message.id);
            pending.delete(message.id);
            if (call === undefined)
                return;
            clearTimeout(call.timer);
            call.resolve(message);
            return;
        }
        if (message.method === 'Page.loadEventFired') {
            const waiter = loadWaiters.get(session.id);
            if (waiter !== undefined) {
                loadWaiters.delete(session.id);
                waiter();
            }
        }
    };
    await cdpSend(session, 'Page.enable');
    await cdpSend(session, 'Runtime.enable');
    await navigateAndWait(session, url);
    return session;
}
/** Capture the current page as a PNG file. */
export async function screenshotPage(session, outputPath) {
    const result = await cdpSend(session, 'Page.captureScreenshot', { format: 'png' });
    if (result.data === undefined)
        throw new Error('CDP screenshot returned no data');
    const buffer = Buffer.from(result.data, 'base64');
    await writeFile(outputPath, buffer);
    return { path: outputPath, bytes: buffer.length };
}
/** Evaluate a JavaScript expression in the page and return the JSON-safe value. */
export async function evaluatePage(session, expression) {
    const result = await cdpSend(session, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
    });
    if (result.exceptionDetails !== undefined) {
        return {
            ok: false,
            error: result.exceptionDetails.exception?.description
                ?? result.exceptionDetails.text
                ?? 'page evaluation failed',
        };
    }
    return { ok: true, result: result.result?.value };
}
/** Close the browser, kill the child process, and remove its profile. */
export async function closeBrowser(session) {
    try {
        session.ws.close();
    }
    catch {
        // Already closed.
    }
    try {
        session.process.kill();
    }
    catch {
        // Already exited.
    }
    await rm(session.userDataDir, { recursive: true, force: true }).catch(() => undefined);
}
//# sourceMappingURL=browser.js.map