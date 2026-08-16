import { defineTool } from "@deepseek-ai/dsh-tools";
//#region lib/types/input.js
/**
* Input simulation command construction. Tools run through `ctx.shell` so the
* same sandbox policy applies as for `tool-screenshot`; the generated commands
* use an embedded C# helper (user32 SendInput/SetCursorPos) to simulate real
* mouse and keyboard input on the current Windows desktop.
*
* @module @deepseek-ai/dsh-tool-input
*/
const C_SHARP_HELPER = `
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class DshInput
{
    [DllImport("user32.dll")] static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT { public uint type; public InputUnion U; }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT
    {
        public int dx; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT
    {
        public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_UNICODE = 0x0004;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    const uint MOUSEEVENTF_WHEEL = 0x0800;

    public static void Move(int x, int y)
    {
        SetCursorPos(x, y);
    }

    public static void Click(string button, int x, int y, int clicks)
    {
        Move(x, y);
        uint down = DownFlag(button);
        uint up = UpFlag(button);
        for (int i = 0; i < clicks; i++)
        {
            mouse_event(down, 0, 0, 0, UIntPtr.Zero);
            mouse_event(up, 0, 0, 0, UIntPtr.Zero);
        }
    }

    public static void Scroll(int delta, int x, int y)
    {
        if (x >= 0 && y >= 0) Move(x, y);
        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
    }

    public static void Trajectory(int[] xs, int[] ys, int durationMs, string action, string button)
    {
        if (xs.Length == 0 || ys.Length == 0 || xs.Length != ys.Length) return;
        int n = xs.Length;
        if (n == 1)
        {
            Move(xs[0], ys[0]);
            if (action == "click") Click(button, xs[0], ys[0], 1);
            else if (action == "double-click") Click(button, xs[0], ys[0], 2);
            return;
        }

        if (action == "drag") MouseDown(button);
        Move(xs[0], ys[0]);

        double[] cumulative = new double[n - 1];
        double total = 0;
        for (int i = 0; i < n - 1; i++)
        {
            double dx = xs[i + 1] - xs[i];
            double dy = ys[i + 1] - ys[i];
            total += Math.Sqrt(dx * dx + dy * dy);
            cumulative[i] = total;
        }

        int steps = Math.Max(1, durationMs / 10);
        for (int step = 1; step <= steps; step++)
        {
            double t = (double)step / steps * total;
            int seg = 0;
            while (seg < cumulative.Length - 1 && cumulative[seg] < t) seg++;
            double segStart = seg == 0 ? 0 : cumulative[seg - 1];
            double segLen = cumulative[seg] - segStart;
            double local = segLen <= 0 ? 0 : (t - segStart) / segLen;
            int x = (int)Math.Round(xs[seg] + (xs[seg + 1] - xs[seg]) * local);
            int y = (int)Math.Round(ys[seg] + (ys[seg + 1] - ys[seg]) * local);
            Move(x, y);
            Thread.Sleep(10);
        }

        Move(xs[n - 1], ys[n - 1]);
        if (action == "click") Click(button, xs[n - 1], ys[n - 1], 1);
        else if (action == "double-click") Click(button, xs[n - 1], ys[n - 1], 2);
        else if (action == "drag") MouseUp(button);
    }

    public static void Keyboard(string text, string[] keys, int delayMs)
    {
        if (keys != null && keys.Length > 0)
        {
            ushort[] vks = new ushort[keys.Length];
            for (int i = 0; i < keys.Length; i++) vks[i] = GetVk(keys[i]);
            foreach (ushort vk in vks)
            {
                SendKey(vk, false);
                Thread.Sleep(delayMs);
            }
            for (int i = vks.Length - 1; i >= 0; i--)
            {
                SendKey(vks[i], true);
                Thread.Sleep(delayMs);
            }
        }
        if (text != null && text.Length > 0)
        {
            foreach (char c in text)
            {
                SendUnicode(c);
                Thread.Sleep(delayMs);
            }
        }
    }

    static uint DownFlag(string button)
    {
        switch (button)
        {
            case "right": return MOUSEEVENTF_RIGHTDOWN;
            case "middle": return MOUSEEVENTF_MIDDLEDOWN;
            default: return MOUSEEVENTF_LEFTDOWN;
        }
    }

    static uint UpFlag(string button)
    {
        switch (button)
        {
            case "right": return MOUSEEVENTF_RIGHTUP;
            case "middle": return MOUSEEVENTF_MIDDLEUP;
            default: return MOUSEEVENTF_LEFTUP;
        }
    }

    static void MouseDown(string button)
    {
        mouse_event(DownFlag(button), 0, 0, 0, UIntPtr.Zero);
    }

    static void MouseUp(string button)
    {
        mouse_event(UpFlag(button), 0, 0, 0, UIntPtr.Zero);
    }

    static void SendUnicode(char c)
    {
        INPUT[] inputs = new INPUT[2];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].U.ki.wVk = 0;
        inputs[0].U.ki.wScan = (ushort)c;
        inputs[0].U.ki.dwFlags = KEYEVENTF_UNICODE;
        inputs[1] = inputs[0];
        inputs[1].U.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    static void SendKey(ushort vk, bool keyUp)
    {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].U.ki.wVk = vk;
        inputs[0].U.ki.dwFlags = keyUp ? KEYEVENTF_KEYUP : 0;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    static ushort GetVk(string key)
    {
        switch (key.ToLowerInvariant())
        {
            case "enter": return 0x0D;
            case "tab": return 0x09;
            case "esc": case "escape": return 0x1B;
            case "space": return 0x20;
            case "backspace": return 0x08;
            case "delete": return 0x2E;
            case "up": return 0x26;
            case "down": return 0x28;
            case "left": return 0x25;
            case "right": return 0x27;
            case "home": return 0x24;
            case "end": return 0x23;
            case "pageup": return 0x21;
            case "pagedown": return 0x22;
            case "ctrl": case "control": return 0x11;
            case "shift": return 0x10;
            case "alt": return 0x12;
            case "win": case "windows": case "meta": return 0x5B;
            default:
                if (key.Length == 1)
                {
                    char c = char.ToUpperInvariant(key[0]);
                    if (c >= 'A' && c <= 'Z') return (ushort)c;
                    if (c >= '0' && c <= '9') return (ushort)c;
                }
                int f;
                if (key.StartsWith("F", StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(key.Substring(1), out f)
                    && f >= 1 && f <= 24) return (ushort)(0x6F + f);
                return 0;
        }
    }
}
`;
function integer(value, name) {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
	return Math.round(value);
}
function nonNegativeInteger(value, name) {
	const n = integer(value, name);
	if (n < 0) throw new Error(`${name} must be non-negative`);
	return n;
}
function positiveInteger(value, name, fallback) {
	if (value === void 0) return fallback;
	const n = integer(value, name);
	if (n <= 0) throw new Error(`${name} must be positive`);
	return n;
}
function validatePoints(points) {
	if (points.length === 0) throw new Error("points must contain at least one point");
	for (const [index, point] of points.entries()) {
		nonNegativeInteger(point.x, `points[${index}].x`);
		nonNegativeInteger(point.y, `points[${index}].y`);
	}
}
function pointArray(points) {
	const xs = points.map((point) => point.x).join(",");
	const ys = points.map((point) => point.y).join(",");
	return {
		xs: `@(${xs})`,
		ys: `@(${ys})`
	};
}
function base64(value) {
	return Buffer.from(value, "utf8").toString("base64");
}
function powershellCommand(calls) {
	return [
		"$ErrorActionPreference='Stop'",
		`$code = @'\n${C_SHARP_HELPER.replaceAll("`", "``").replaceAll("$", "`$")}\n'@`,
		"Add-Type -TypeDefinition $code -Language CSharp",
		...calls
	].join("; ");
}
/**
* Build the PowerShell command for mouse trajectory movement/click/drag.
* @param options - trajectory points and terminal action.
* @returns a PowerShell command string.
*/
function buildMouseTrajectoryCommand(options) {
	validatePoints(options.points);
	const durationMs = positiveInteger(options.durationMs, "duration_ms", 300);
	const action = options.action ?? "move";
	const button = options.button ?? "left";
	const { xs, ys } = pointArray(options.points);
	return powershellCommand([`[DshInput]::Trajectory(${xs}, ${ys}, ${durationMs}, '${action}', '${button}')`]);
}
/**
* Build the PowerShell command for a mouse click at one coordinate.
* @param options - click coordinate, button, click count, and optional duration.
* @returns a PowerShell command string.
*/
function buildMouseClickCommand(options) {
	const x = nonNegativeInteger(options.x, "x");
	const y = nonNegativeInteger(options.y, "y");
	const button = options.button ?? "left";
	const clicks = positiveInteger(options.clicks ?? 1, "clicks", 1);
	const durationMs = positiveInteger(options.durationMs, "duration_ms", 100);
	return buildMouseTrajectoryCommand({
		points: [{
			x,
			y
		}],
		durationMs,
		action: clicks > 1 ? "double-click" : "click",
		button
	});
}
/**
* Build the PowerShell command for a mouse wheel scroll.
* @param options - scroll delta and optional target coordinate.
* @returns a PowerShell command string.
*/
function buildMouseScrollCommand(options) {
	return powershellCommand([`[DshInput]::Scroll(${integer(options.delta, "delta")}, ${options.x === void 0 ? -1 : nonNegativeInteger(options.x, "x")}, ${options.y === void 0 ? -1 : nonNegativeInteger(options.y, "y")})`]);
}
/**
* Build the PowerShell command for keyboard text/keys input.
* @param options - literal text, key combo, and per-key delay.
* @returns a PowerShell command string.
*/
function buildKeyboardCommand(options) {
	const text = options.text ?? "";
	const keys = options.keys ?? [];
	const delayMs = positiveInteger(options.delayMs, "delay_ms", 30);
	if (text === "" && keys.length === 0) throw new Error("keyboard_input requires text or keys");
	return powershellCommand([`[DshInput]::Keyboard([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${base64(text)}')), ${keys.length === 0 ? "@()" : `@(${keys.map((key) => `'${key.replaceAll("'", "''")}'`).join(",")})`}, ${delayMs})`]);
}
//#endregion
//#region lib/types/index.js
/**
* Human-hand input simulation tools: mouse trajectory/click/scroll and
* keyboard input. Execution goes through the `ctx.shell` capability seam with
* a full-access sandbox policy because real desktop input requires the same
* desktop/display access as `tool-screenshot`.
*
* @module @deepseek-ai/dsh-tool-input
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "tool-input";
/** Services required by the input tools. */
const inject = ["tools", "shell"];
const POINT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		x: {
			type: "number",
			required: true,
			description: "屏幕 X 坐标（像素）"
		},
		y: {
			type: "number",
			required: true,
			description: "屏幕 Y 坐标（像素）"
		}
	}
};
async function runCommand(ctx, command, exec) {
	const result = await ctx.shell.run(ctx.shell.resolve({
		command,
		timeoutMs: 6e4,
		signal: exec.signal,
		sandboxPolicy: {
			mode: "danger-full-access",
			workspaceRoot: process.cwd()
		}
	}));
	if (result.exitCode !== 0) {
		const detail = result.stderr.text !== "" ? result.stderr.text : result.stdout.text;
		throw new Error(`input command failed: ${detail.trim()}`);
	}
}
/**
* Register the input simulation tools.
* @param ctx - plugin context carrying tools and shell services.
*/
function apply(ctx) {
	ctx.tools.register(defineTool({
		name: "mouse_trajectory",
		description: "模拟鼠标沿轨迹移动，可执行点击/双击/拖动。会真实控制当前桌面鼠标。",
		parameters: {
			points: {
				type: "array",
				required: true,
				items: POINT_SCHEMA,
				description: "轨迹点列表，至少一个点"
			},
			duration_ms: {
				type: "number",
				description: "移动总耗时（毫秒，默认 300）"
			},
			action: {
				type: "string",
				enum: [
					"move",
					"click",
					"double-click",
					"drag"
				],
				description: "终点动作（默认 move）"
			},
			button: {
				type: "string",
				enum: [
					"left",
					"right",
					"middle"
				],
				description: "鼠标按键（默认 left）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					points: {
						type: "integer",
						required: true
					},
					action: {
						type: "string",
						required: true
					},
					duration_ms: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `鼠标${value.action}完成：${value.points} 个轨迹点，耗时 ${value.duration_ms}ms`
			}]
		},
		async execute(args, exec) {
			const points = args.points;
			const action = args.action ?? "move";
			const button = args.button ?? "left";
			const durationMs = args.duration_ms;
			await runCommand(ctx, buildMouseTrajectoryCommand({
				points,
				action,
				button,
				...durationMs === void 0 ? {} : { durationMs }
			}), exec);
			return {
				points: points.length,
				action,
				duration_ms: durationMs ?? 300
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "mouse_click",
		description: "在指定屏幕坐标点击鼠标（支持左右中键、单击/双击）。会真实控制当前桌面鼠标。",
		parameters: {
			x: {
				type: "number",
				required: true,
				description: "屏幕 X 坐标（像素）"
			},
			y: {
				type: "number",
				required: true,
				description: "屏幕 Y 坐标（像素）"
			},
			button: {
				type: "string",
				enum: [
					"left",
					"right",
					"middle"
				],
				description: "鼠标按键（默认 left）"
			},
			clicks: {
				type: "integer",
				description: "点击次数（默认 1，2 表示双击）"
			},
			duration_ms: {
				type: "number",
				description: "移动耗时（毫秒，默认 100）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					x: {
						type: "integer",
						required: true
					},
					y: {
						type: "integer",
						required: true
					},
					button: {
						type: "string",
						required: true
					},
					clicks: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `已在 (${value.x}, ${value.y}) ${value.button}${value.clicks > 1 ? ` ${value.clicks} 次` : ""}点击`
			}]
		},
		async execute(args, exec) {
			const x = args.x;
			const y = args.y;
			const button = args.button ?? "left";
			const clicks = args.clicks ?? 1;
			const durationMs = args.duration_ms;
			await runCommand(ctx, buildMouseClickCommand({
				x,
				y,
				button,
				clicks,
				...durationMs === void 0 ? {} : { durationMs }
			}), exec);
			return {
				x,
				y,
				button,
				clicks
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "mouse_scroll",
		description: "模拟鼠标滚轮滚动。正数向上滚动，负数向下滚动；可选先移动到指定坐标。",
		parameters: {
			delta: {
				type: "integer",
				required: true,
				description: "滚轮滚动量（正数向上，负数向下）"
			},
			x: {
				type: "integer",
				description: "滚动前移动到的 X 坐标（可选）"
			},
			y: {
				type: "integer",
				description: "滚动前移动到的 Y 坐标（可选）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					delta: {
						type: "integer",
						required: true
					},
					x: { type: "integer" },
					y: { type: "integer" }
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `滚轮滚动 ${value.delta}${value.x !== void 0 ? ` @ (${value.x}, ${value.y})` : ""}`
			}]
		},
		async execute(args, exec) {
			const delta = args.delta;
			const x = args.x;
			const y = args.y;
			await runCommand(ctx, buildMouseScrollCommand({
				delta,
				...x === void 0 ? {} : { x },
				...y === void 0 ? {} : { y }
			}), exec);
			return {
				delta,
				...x === void 0 ? {} : { x },
				...y === void 0 ? {} : { y }
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "keyboard_input",
		description: "模拟键盘输入：可输入文本，也可按组合键（如 ctrl+c、alt+tab）。会真实控制当前桌面键盘。",
		parameters: {
			text: {
				type: "string",
				description: "要输入的文本"
			},
			keys: {
				type: "array",
				items: { type: "string" },
				description: "按键组合，如 [\"ctrl\",\"c\"]；支持 enter/tab/esc/space/arrows/F1-F24/字母/数字等"
			},
			delay_ms: {
				type: "integer",
				description: "每个字符/按键之间的延迟（毫秒，默认 30）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					text_length: {
						type: "integer",
						required: true
					},
					keys: {
						type: "array",
						items: { type: "string" },
						required: true
					},
					delay_ms: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `键盘输入完成：文本 ${value.text_length} 字符，按键 [${value.keys.join(", ")}]`
			}]
		},
		async execute(args, exec) {
			const text = args.text ?? "";
			const keys = args.keys ?? [];
			const delayMs = args.delay_ms ?? 30;
			await runCommand(ctx, buildKeyboardCommand({
				text,
				keys,
				delayMs
			}), exec);
			return {
				text_length: text.length,
				keys,
				delay_ms: delayMs
			};
		}
	}));
}
//#endregion
export { apply, inject, name };
