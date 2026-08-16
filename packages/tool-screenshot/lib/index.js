import { defineTool } from "@deepseek-ai/dsh-tools";
import { tmpdir } from "node:os";
import { join } from "node:path";
//#region lib/types/screenshot.js
/**
* Screenshot command construction and execution. The tool captures the screen
* through the shell capability seam so the same sandbox policy applies as for
* `tool-pwsh`; the saved PNG path is then available to an external vision MCP
* tool (`mcp__glm4v__analyze_image`) for the agent's own image-recognition loop.
*
* @module @deepseek-ai/dsh-tool-screenshot
*/
/** Default screenshot path: a timestamped PNG in the OS temp directory. */
function defaultScreenshotPath() {
	return join(tmpdir(), `dsh-screenshot-${Date.now()}.png`);
}
/** Parse `x,y,w,h`; returns undefined for an absent region. */
function parseRegion(region) {
	if (region === void 0 || region.trim() === "") return void 0;
	const parts = region.split(",").map((part) => Number(part.trim()));
	if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0)) throw new Error(`invalid region "${region}": expected x,y,w,h in pixels`);
	const [x, y, w, h] = parts;
	if (x === void 0 || y === void 0 || w === void 0 || h === void 0) throw new Error(`invalid region "${region}": expected x,y,w,h in pixels`);
	return [
		x,
		y,
		w,
		h
	];
}
/** Quote one path for a PowerShell single-quoted string. */
function quotePowerShell(path) {
	return `'${path.replaceAll("'", "''")}'`;
}
/** Quote one path for a POSIX shell single-quoted string. */
function quotePosix(path) {
	return `'${path.replaceAll("'", "'\\''")}'`;
}
/**
* Build the platform-specific shell command that captures the screen to a PNG.
* @param platform - Node.js platform identifier.
* @param outputPath - absolute PNG path to write.
* @param region - optional `x,y,w,h` capture region.
* @returns the shell command string.
*/
function screenshotCommand(platform, outputPath, region) {
	const parsed = parseRegion(region);
	if (platform === "win32") {
		const ps = [
			"$ErrorActionPreference='Stop'",
			"Add-Type -AssemblyName System.Windows.Forms,System.Drawing",
			"$b=[System.Windows.Forms.SystemInformation]::VirtualScreen",
			"$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height",
			"$g=[System.Drawing.Graphics]::FromImage($bmp)"
		];
		if (parsed !== void 0) {
			ps.push(`$r=New-Object System.Drawing.Rectangle(${parsed[0]},${parsed[1]},${parsed[2]},${parsed[3]})`);
			ps.push("$g.CopyFromScreen($r.Left,$r.Top,0,0,$r.Size)");
		} else ps.push("$g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size)");
		ps.push(`$bmp.Save(${quotePowerShell(outputPath)},[System.Drawing.Imaging.ImageFormat]::Png)`);
		ps.push("$g.Dispose(); $bmp.Dispose()");
		return ps.join("; ");
	}
	const quoted = quotePosix(outputPath);
	if (platform === "darwin") return parsed === void 0 ? `screencapture -x ${quoted}` : `screencapture -x -R ${parsed[0]},${parsed[1]},${parsed[2]},${parsed[3]} ${quoted}`;
	return parsed === void 0 ? `import -window root ${quoted}` : `import -window root -crop ${parsed[2]}x${parsed[3]}+${parsed[0]}+${parsed[1]} ${quoted}`;
}
/**
* Capture the screen through `ctx.shell`, then stat the resulting PNG through
* `ctx.fs` so the returned size is a harness-observed fact.
* @param ctx - plugin context with shell and filesystem services.
* @param options - output path and optional region.
* @param signal - abort signal forwarded to shell and filesystem calls.
* @returns the saved PNG path and byte size.
*/
async function takeScreenshot(ctx, options, signal) {
	const outputPath = options.outputPath?.trim() === "" || options.outputPath === void 0 ? defaultScreenshotPath() : options.outputPath;
	const command = screenshotCommand(process.platform, outputPath, options.region);
	const result = await ctx.shell.run(ctx.shell.resolve({
		command,
		timeoutMs: 3e4,
		signal
	}));
	if (result.exitCode !== 0) {
		const detail = result.stderr.text !== "" ? result.stderr.text : result.stdout.text;
		throw new Error(`screenshot failed: ${detail.trim()}`);
	}
	const info = await ctx.fs.lstat(outputPath, void 0, signal);
	if (info === void 0 || info.type !== "file") throw new Error(`screenshot file not found after capture: ${outputPath}`);
	return {
		path: outputPath,
		bytes: info.size ?? 0
	};
}
//#endregion
//#region lib/types/index.js
/**
* Model-facing screenshot tool: captures the current screen to a PNG so the
* agent can recognize its own screenshots through an external vision MCP tool
* (`mcp__glm4v__analyze_image` / `ocr_image`). Execution goes through the
* `ctx.shell` capability seam, so the same sandbox policy applies as for other
* shell-backed tools.
*
* @module @deepseek-ai/dsh-tool-screenshot
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "tool-screenshot";
/** Services required by the screenshot tool. */
const inject = [
	"tools",
	"shell",
	"fs"
];
/**
* Register the `screenshot` tool.
* @param ctx - plugin context carrying tools, shell, and filesystem services.
*/
function apply(ctx) {
	ctx.tools.register(defineTool({
		name: "screenshot",
		description: "截取当前屏幕保存为 PNG，返回图片文件的绝对路径。截图后请调用 mcp__glm4v__analyze_image 或 mcp__glm4v__ocr_image 识别该图片。",
		parameters: {
			output_path: {
				type: "string",
				description: "保存 PNG 的路径（默认系统临时目录，建议传入工作区绝对路径）"
			},
			region: {
				type: "string",
				description: "截图区域 `x,y,w,h`（像素，默认全屏）"
			}
		},
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
				text: `截图已保存：${value.path}（${value.bytes} 字节）`
			}]
		},
		async execute(args, exec) {
			return takeScreenshot(ctx, {
				outputPath: args.output_path,
				region: args.region
			}, exec.signal);
		}
	}));
}
//#endregion
export { apply, inject, name };
