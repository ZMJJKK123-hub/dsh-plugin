import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
//#region lib/types/browser.js
/**
* Minimal CDP browser automation for headless Microsoft Edge. Launches a
* background Edge instance, connects over the DevTools WebSocket, and exposes
* navigate/screenshot/evaluate primitives for the agent's
* screenshot-analyze-operate loop.
*
* @module @deepseek-ai/dsh-tool-browser
*/
const pending = /* @__PURE__ */ new Map();
const loadWaiters = /* @__PURE__ */ new Map();
let nextId = 1;
function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
function edgeExecutable() {
	const programFiles86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
	const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
	const found = [join(programFiles86, "Microsoft", "Edge", "Application", "msedge.exe"), join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe")].find((path) => existsSync(path));
	if (found === void 0) throw new Error("Microsoft Edge was not found on this system");
	return found;
}
async function readDevToolsPort(userDataDir, process) {
	const file = join(userDataDir, "DevToolsActivePort");
	for (let attempt = 0; attempt < 100; attempt += 1) {
		if (process.exitCode !== null) throw new Error("Edge exited before the DevTools port was ready");
		try {
			const text = await readFile(file, "utf8");
			const port = Number(text.split(/\r?\n/)[0]);
			if (Number.isInteger(port) && port > 0) return port;
		} catch {}
		await delay(100);
	}
	throw new Error("Timed out waiting for Edge DevTools port");
}
async function findPageTarget(port) {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		try {
			const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((target) => target.type === "page" && target.webSocketDebuggerUrl !== void 0);
			if (page?.id !== void 0 && page.webSocketDebuggerUrl !== void 0) return {
				id: page.id,
				webSocketDebuggerUrl: page.webSocketDebuggerUrl
			};
		} catch {}
		await delay(100);
	}
	throw new Error("Timed out waiting for Edge page target");
}
function cdpSend(session, method, params = {}) {
	return new Promise((resolve, reject) => {
		const id = nextId;
		nextId += 1;
		const timer = setTimeout(() => {
			pending.delete(id);
			reject(/* @__PURE__ */ new Error(`CDP ${method} timed out`));
		}, 3e4);
		pending.set(id, {
			resolve,
			reject,
			timer
		});
		session.ws.send(JSON.stringify({
			id,
			method,
			params
		}));
	});
}
async function navigateAndWait(session, url) {
	await new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			if (loadWaiters.delete(session.id)) resolve();
		}, 15e3);
		loadWaiters.set(session.id, () => {
			clearTimeout(timer);
			resolve();
		});
		cdpSend(session, "Page.navigate", { url }).catch((error) => {
			clearTimeout(timer);
			loadWaiters.delete(session.id);
			reject(error instanceof Error ? error : new Error(String(error)));
		});
	});
}
/** Launch headless Edge, open the URL, and return a connected session. */
async function openBrowser(url, headless) {
	const userDataDir = await mkdtemp(join(tmpdir(), "dsh-browser-"));
	const args = [
		`--user-data-dir=${userDataDir}`,
		"--remote-debugging-port=0",
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-default-apps",
		"--disable-extensions",
		"--disable-background-networking",
		"--disable-features=Translate",
		...headless ? ["--headless=new"] : [],
		"about:blank"
	];
	const child = spawn(edgeExecutable(), args, {
		stdio: "ignore",
		windowsHide: true
	});
	child.on("error", () => void 0);
	const port = await readDevToolsPort(userDataDir, child);
	const target = await findPageTarget(port);
	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((resolve, reject) => {
		ws.onopen = () => {
			resolve();
		};
		ws.onerror = () => {
			reject(/* @__PURE__ */ new Error("CDP WebSocket connection failed"));
		};
	});
	const session = {
		id: randomUUID(),
		process: child,
		ws,
		port,
		userDataDir,
		targetId: target.id
	};
	ws.onmessage = (event) => {
		let message;
		try {
			message = JSON.parse(String(event.data));
		} catch {
			return;
		}
		if (message.id !== void 0 && pending.has(message.id)) {
			const call = pending.get(message.id);
			pending.delete(message.id);
			if (call === void 0) return;
			clearTimeout(call.timer);
			call.resolve(message);
			return;
		}
		if (message.method === "Page.loadEventFired") {
			const waiter = loadWaiters.get(session.id);
			if (waiter !== void 0) {
				loadWaiters.delete(session.id);
				waiter();
			}
		}
	};
	await cdpSend(session, "Page.enable");
	await cdpSend(session, "Runtime.enable");
	await navigateAndWait(session, url);
	return session;
}
/** Capture the current page as a PNG file. */
async function screenshotPage(session, outputPath) {
	const result = await cdpSend(session, "Page.captureScreenshot", { format: "png" });
	if (result.data === void 0) throw new Error("CDP screenshot returned no data");
	const buffer = Buffer.from(result.data, "base64");
	await writeFile(outputPath, buffer);
	return {
		path: outputPath,
		bytes: buffer.length
	};
}
/** Evaluate a JavaScript expression in the page and return the JSON-safe value. */
async function evaluatePage(session, expression) {
	const result = await cdpSend(session, "Runtime.evaluate", {
		expression,
		returnByValue: true,
		awaitPromise: true
	});
	if (result.exceptionDetails !== void 0) return {
		ok: false,
		error: result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "page evaluation failed"
	};
	return {
		ok: true,
		result: result.result?.value
	};
}
/** Close the browser, kill the child process, and remove its profile. */
async function closeBrowser(session) {
	try {
		session.ws.close();
	} catch {}
	try {
		session.process.kill();
	} catch {}
	await rm(session.userDataDir, {
		recursive: true,
		force: true
	}).catch(() => void 0);
}
//#endregion
//#region lib/types/index.js
/**
* Background browser automation tools for the screenshot-analyze-operate
* loop. Uses headless Microsoft Edge over CDP so the browser never steals the
* foreground from the user's current application.
*
* @module @deepseek-ai/dsh-tool-browser
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "tool-browser";
/** Services required by the browser tools. */
const inject = ["tools"];
/** Live browser per agent session. */
const browsers = /* @__PURE__ */ new Map();
function sessionKey(exec) {
	const sessionId = exec.agent?.session.id;
	if (sessionId === void 0) throw new Error("browser tools require an agent session");
	return String(sessionId);
}
function requireBrowser(exec) {
	const key = sessionKey(exec);
	const browser = browsers.get(key);
	if (browser === void 0) throw new Error("no browser is open for this session; call browser_open first");
	return browser;
}
/**
* Register the browser tools.
* @param ctx - plugin context carrying the tools registry.
*/
function apply(ctx) {
	ctx.tools.register(defineTool({
		name: "browser_open",
		description: "在后台（无头 Edge）打开一个网页，返回浏览器句柄。用于自动打开测试网站后截图/分析/操作。",
		parameters: {
			url: {
				type: "string",
				required: true,
				description: "要打开的网址，例如 http://localhost:8000"
			},
			headless: {
				type: "boolean",
				description: "是否无头运行（默认 true，不显示窗口）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					handle: {
						type: "string",
						required: true
					},
					url: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `已打开 ${value.url}（handle: ${value.handle}）`
			}]
		},
		async execute(args, exec) {
			const key = sessionKey(exec);
			const existing = browsers.get(key);
			if (existing !== void 0) {
				await closeBrowser(existing);
				browsers.delete(key);
			}
			const browser = await openBrowser(args.url, args.headless ?? true);
			browsers.set(key, browser);
			return {
				handle: browser.id,
				url: args.url
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "browser_screenshot",
		description: "截取当前后台网页内容并保存为 PNG，返回图片路径。用于配合 mcp__glm4v__analyze_image 分析页面。",
		parameters: { output_path: {
			type: "string",
			description: "保存 PNG 的路径（默认系统临时目录）"
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true
					},
					bytes: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `页面截图已保存：${value.path}（${value.bytes} 字节）`
			}]
		},
		async execute(args, exec) {
			return screenshotPage(requireBrowser(exec), args.output_path?.trim() === "" || args.output_path === void 0 ? join(tmpdir(), `dsh-browser-${Date.now()}.png`) : args.output_path);
		}
	}));
	ctx.tools.register(defineTool({
		name: "browser_eval",
		description: "在后台网页里执行一段 JavaScript，返回结果。用于点击、输入、读取页面状态等操作。",
		parameters: { expression: {
			type: "string",
			required: true,
			description: "要执行的 JS 表达式，例如 document.querySelector(\"button\").click()"
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { result: {
					type: "string",
					required: true
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: `执行结果：${value.result}`
			}]
		},
		async execute(args, exec) {
			const outcome = await evaluatePage(requireBrowser(exec), args.expression);
			if (!outcome.ok) throw new Error(outcome.error ?? "browser_eval failed");
			return { result: JSON.stringify(outcome.result ?? null) };
		}
	}));
	ctx.tools.register(defineTool({
		name: "browser_close",
		description: "关闭当前会话的后台浏览器，释放资源。",
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { closed: {
					type: "boolean",
					required: true
				} }
			},
			render: () => [{
				type: "text",
				text: "浏览器已关闭"
			}]
		},
		async execute(_args, exec) {
			const key = sessionKey(exec);
			const browser = browsers.get(key);
			if (browser !== void 0) {
				await closeBrowser(browser);
				browsers.delete(key);
			}
			return { closed: true };
		}
	}));
	ctx.on("session/disposed", (session) => {
		const browser = browsers.get(String(session.id));
		if (browser !== void 0) {
			browsers.delete(String(session.id));
			closeBrowser(browser);
		}
	});
}
//#endregion
export { apply, inject, name };
