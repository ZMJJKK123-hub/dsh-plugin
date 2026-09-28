import z from "@deepseek-ai/schemastery";
//#region lib/types/index.js
/**
* The CUA confirmation gate and capability precheck: the first Computer-Use
* tool call per session (screenshot or input simulation) asks the user for
* approval through the approval seam; the decision is cached for the
* session's lifetime. The capability precheck verifies the platform's
* screen-capture command works before the first approval ask.
*
* @module @dsh-custom/dsh-cua-guard
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "cua-guard";
/** Services required by the guard. */
const inject = [
	"tools",
	"approval",
	"shell"
];
/** The Computer-Use tool names this guard gates. */
const CUA_TOOL_NAMES = [
	"screenshot",
	"mouse_click",
	"mouse_trajectory",
	"mouse_scroll",
	"keyboard_input"
];
const Config = z.object({
	enabled: z.boolean().default(true),
	reaskMs: z.number().default(0)
});
/**
* The platform's screen-capture availability probe: a shell command that
* exits 0 when the capture capability exists on this platform.
*/
function captureProbeCommand(platform) {
	if (platform === "win32") return "powershell -NoProfile -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemInformation]::VirtualScreen | Out-Null\"";
	if (platform === "darwin") return "which screencapture";
	return "which import";
}
function apply(ctx, config = {}) {
	if (config.enabled === false) return;
	const reaskMs = config.reaskMs ?? 0;
	const cuaTools = new Set(CUA_TOOL_NAMES);
	/** Session-id → latest decision. */
	const grants = /* @__PURE__ */ new Map();
	/** Whether the platform probe ran and passed. */
	let platformReady;
	/** The capability precheck: verify screen capture works on this host. */
	const precheck = async (signal) => {
		if (platformReady !== void 0) return platformReady;
		try {
			const spec = ctx.shell.resolve({
				command: captureProbeCommand(process.platform),
				timeoutMs: 1e4,
				signal
			});
			platformReady = (await ctx.shell.run(spec)).exitCode === 0;
		} catch {
			platformReady = false;
		}
		return platformReady;
	};
	ctx.on("tools/pre-execute", async (exec, next) => {
		if (!cuaTools.has(exec.name)) return next();
		const agent = exec.agent;
		if (agent === void 0) return next();
		const cached = grants.get(agent.session.id);
		const now = Date.now();
		if (cached !== void 0) {
			if (!cached.allowed) return {
				kind: "deny",
				reason: "CUA was rejected for this session. Restart the session to re-enable."
			};
			if (reaskMs === 0 || now - cached.at < reaskMs) return next();
		}
		if (!await precheck(exec.signal)) return {
			kind: "deny",
			reason: `Screen capture is not available on this ${process.platform} host (the capture tool was not found). CUA tools are disabled.`
		};
		if (await ctx.approval.request({
			agent,
			toolName: exec.name,
			callId: exec.callId,
			reason: "Allow the agent to use Computer-Use tools (screenshots, mouse, keyboard) on this machine?"
		}) === "allowed-once") {
			grants.set(agent.session.id, {
				allowed: true,
				at: now
			});
			return next();
		}
		grants.set(agent.session.id, {
			allowed: false,
			at: now
		});
		return {
			kind: "deny",
			reason: "CUA was rejected. The agent will not control your screen in this session."
		};
	});
	ctx.on("session/disposed", (session) => {
		grants.delete(session.id);
	});
}
//#endregion
export { CUA_TOOL_NAMES, Config, apply, captureProbeCommand, inject, name };
