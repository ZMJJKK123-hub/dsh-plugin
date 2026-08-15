import z from "@deepseek-ai/schemastery";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { dshHomePath } from "@deepseek-ai/dsh-home-paths";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { spawn } from "node:child_process";
//#region lib/types/diff.js
/**
* Line-level text diffing for the change monitor: LCS-based edit scripts over
* trimmed common prefixes/suffixes, rendered as context-bearing hunks with
* per-line before/after numbers and add/delete counts. Degrades to whole-file
* replacement hunks under a cell budget so a pathological input cannot hang
* the turn.
*
* @module @deepseek-ai/dsh-change-monitor
*/
/**
* Split text into normalized lines: CRLF is stripped, and a trailing final
* newline does not produce a phantom empty line (the newline belongs to the
* last line's terminator, so line counts match user intuition).
*/
function linesOf(text) {
	if (text === "") return [];
	const lines = text.split("\n");
	if (lines.at(-1) === "") lines.pop();
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (line !== void 0 && line.endsWith("\r")) lines[index] = line.slice(0, -1);
	}
	return lines;
}
/**
* Compute an edit script for `before` vs `after` with the classic LCS DP,
* after trimming the common prefix and suffix so localized edits stay small.
* A trimmed middle whose product exceeds `maxCells` is bisected at shared
* anchor lines and diffed recursively, so large mostly-unchanged files still
* produce hunks around the actual edits instead of one whole-region replace.
*/
function editScript(before, after, maxCells) {
	let prefix = 0;
	const common = Math.min(before.length, after.length);
	while (prefix < common && before[prefix] === after[prefix]) prefix += 1;
	let suffix = 0;
	while (suffix < common - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
	const midBefore = before.slice(prefix, before.length - suffix);
	const midAfter = after.slice(prefix, after.length - suffix);
	const n = midBefore.length;
	const m = midAfter.length;
	const ops = [];
	for (let index = 0; index < prefix; index += 1) ops.push("keep");
	if (n === 0 && m === 0) {
		for (let index = 0; index < suffix; index += 1) ops.push("keep");
		return ops;
	}
	ops.push(...diffMiddle(midBefore, midAfter, maxCells));
	for (let index = 0; index < suffix; index += 1) ops.push("keep");
	return ops;
}
/**
* Diff the trimmed middle region. A small product runs the exact LCS; a large
* one is bisected at a shared anchor line (a before line whose text also
* occurs near the after middle) and each half recurses, so a big file with a
* localized edit keeps its untouched runs as context instead of degrading to
* one whole-region replace hunk. Only a middle with no shared anchor at all
* falls back to replace-all.
*/
function diffMiddle(before, after, maxCells) {
	const n = before.length;
	const m = after.length;
	if (n === 0) return after.map(() => "add");
	if (m === 0) return before.map(() => "del");
	if (n * m <= maxCells) return lcsOps(before, after, maxCells);
	const afterIndex = /* @__PURE__ */ new Map();
	for (let index = 0; index < m; index += 1) {
		const line = after[index];
		const positions = afterIndex.get(line);
		if (positions === void 0) afterIndex.set(line, [index]);
		else positions.push(index);
	}
	const mid = Math.floor(n / 2);
	const probe = 8;
	for (let offset = 0; offset <= probe; offset += 1) for (const index of offset === 0 ? [mid] : [mid - offset, mid + offset]) {
		if (index < 0 || index >= n) continue;
		const positions = afterIndex.get(before[index]);
		if (positions === void 0 || positions.length === 0) continue;
		const afterIndex2 = positions.reduce((closest, position) => Math.abs(position - m / 2) < Math.abs(closest - m / 2) ? position : closest, positions[0]);
		const left = diffMiddle(before.slice(0, index), after.slice(0, afterIndex2), maxCells);
		const right = diffMiddle(before.slice(index + 1), after.slice(afterIndex2 + 1), maxCells);
		return [
			...left,
			"keep",
			...right
		];
	}
	return [...before.map(() => "del"), ...after.map(() => "add")];
}
/** Exact LCS over a bounded region (the original DP with replace-all fallback). */
function lcsOps(before, after, maxCells) {
	const ops = [];
	const n = before.length;
	const m = after.length;
	const replaceAll = () => {
		for (let index = 0; index < n; index += 1) ops.push("del");
		for (let index = 0; index < m; index += 1) ops.push("add");
		return ops;
	};
	if (n * m > maxCells) return replaceAll();
	const width = m + 1;
	const table = new Uint32Array((n + 1) * width);
	for (let i = 1; i <= n; i += 1) {
		const beforeLine = before[i - 1];
		for (let j = 1; j <= m; j += 1) {
			const cell = i * width + j;
			const diag = (i - 1) * width + (j - 1);
			const up = (i - 1) * width + j;
			const left = i * width + (j - 1);
			if (beforeLine === after[j - 1]) table[cell] = table[diag] + 1;
			else table[cell] = Math.max(table[up], table[left]);
		}
	}
	let i = n;
	let j = m;
	const traced = [];
	while (i > 0 && j > 0) if (before[i - 1] === after[j - 1]) {
		traced.push("keep");
		i -= 1;
		j -= 1;
	} else if (table[(i - 1) * width + j] > table[i * width + (j - 1)]) {
		traced.push("del");
		i -= 1;
	} else {
		traced.push("add");
		j -= 1;
	}
	while (i > 0) {
		traced.push("del");
		i -= 1;
	}
	while (j > 0) {
		traced.push("add");
		j -= 1;
	}
	traced.reverse();
	ops.push(...traced);
	return ops;
}
/**
* Diff two texts at line granularity.
* @param before - original text.
* @param after - modified text.
* @param options - context width and cell budget.
* @returns hunks and aggregate counts.
*/
function diffText(before, after, options) {
	const beforeLines = linesOf(before);
	const afterLines = linesOf(after);
	const ops = editScript(beforeLines, afterLines, options.maxCells);
	const positions = [];
	let oldLine = 1;
	let newLine = 1;
	let additions = 0;
	let deletions = 0;
	ops.forEach((op, index) => {
		if (op === "add") {
			positions.push({
				index,
				oldLine,
				newLine
			});
			newLine += 1;
			additions += 1;
		} else if (op === "del") {
			positions.push({
				index,
				oldLine,
				newLine
			});
			oldLine += 1;
			deletions += 1;
		} else {
			oldLine += 1;
			newLine += 1;
		}
	});
	if (positions.length === 0) return {
		hunks: [],
		additions,
		deletions
	};
	const groups = [];
	let group = [];
	let lastOldLine;
	for (const position of positions) {
		if (lastOldLine !== void 0 && position.oldLine - lastOldLine > options.contextLines * 2) {
			groups.push(group);
			group = [];
		}
		group.push(position);
		lastOldLine = position.oldLine;
	}
	groups.push(group);
	return {
		hunks: groups.map((changes) => {
			const first = changes[0];
			const last = changes[changes.length - 1];
			const start = Math.max(0, first.index - options.contextLines);
			const end = Math.min(ops.length, last.index + 1 + options.contextLines);
			const lines = [];
			let old = 1;
			let newNumber = 1;
			for (let index = 0; index < end; index += 1) {
				const op = ops[index];
				const text = op === "add" ? afterLines[newNumber - 1] : beforeLines[old - 1];
				if (index >= start) if (op === "add") lines.push({
					kind: "add",
					oldLine: null,
					newLine: newNumber,
					text
				});
				else if (op === "del") lines.push({
					kind: "del",
					oldLine: old,
					newLine: null,
					text
				});
				else lines.push({
					kind: "context",
					oldLine: old,
					newLine: newNumber,
					text
				});
				if (op === "add") newNumber += 1;
				else if (op === "del") old += 1;
				else {
					old += 1;
					newNumber += 1;
				}
			}
			const hunkOldStart = oldForIndex(start, ops, beforeLines.length);
			const hunkNewStart = newForIndex(start, ops, afterLines.length);
			return {
				oldStart: hunkOldStart,
				oldLines: lines.reduce((count, line) => count + (line.kind === "del" || line.kind === "context" ? 1 : 0), 0),
				newStart: hunkNewStart,
				newLines: lines.reduce((count, line) => count + (line.kind === "add" || line.kind === "context" ? 1 : 0), 0),
				lines
			};
		}),
		additions,
		deletions
	};
}
/** Old-side line number at one ops index. */
function oldForIndex(index, ops, totalBefore) {
	let old = 1;
	for (let cursor = 0; cursor < index; cursor += 1) if (ops[cursor] !== "add") old += 1;
	return old > totalBefore ? Math.max(1, totalBefore) : old;
}
/** New-side line number at one ops index. */
function newForIndex(index, ops, totalAfter) {
	let newNumber = 1;
	for (let cursor = 0; cursor < index; cursor += 1) if (ops[cursor] !== "del") newNumber += 1;
	return newNumber > totalAfter ? Math.max(1, totalAfter) : newNumber;
}
const DEFAULT_MAX_DIFF_CELLS = 25e6;
//#endregion
//#region lib/types/ignore.js
/**
* Ignore-pattern matching for workspace snapshots. Patterns follow a small
* gitignore-lite dialect: `*` matches within one path segment, `**` crosses
* segments, `?` matches one character, a trailing `/` restricts to
* directories, and a pattern without `/` matches any basename at any depth.
*
* @module @deepseek-ai/dsh-change-monitor
*/
/**
* Default exclusions: VCS/metadata directories, dependency and build output
* directories, and transient file shapes. Deliberately NOT excluded are lock
* files (`pnpm-lock.yaml`, `package-lock.json`, `requirements.txt`) — those
* are real project changes.
*/
const DEFAULT_IGNORE_PATTERNS = [
	".git/",
	"node_modules/",
	".venv/",
	"venv/",
	"__pycache__/",
	"dist/",
	"build/",
	"lib/",
	"bin/",
	".next/",
	".cache/",
	"coverage/",
	".turbo/",
	".nx/",
	".idea/",
	".vscode/",
	".DS_Store/",
	"out/",
	"target/",
	".pytest_cache/",
	".mypy_cache/",
	"*.pyc",
	"*.pyo",
	"*.log",
	"*.tmp",
	"*.temp",
	"*.swp",
	"*.swo",
	"*.part",
	"*.map",
	"*.tsbuildinfo",
	".DS_Store",
	"Thumbs.db",
	"desktop.ini"
];
/** Escape every regex metacharacter except the glob wildcards we translate. */
function escapeGlob(source) {
	let out = "";
	for (const char of source) if (char === "*") out += "*";
	else if (char === "?") out += "?";
	else out += /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
	return out;
}
/** Translate one glob pattern (no leading `!`) into a compiled matcher. */
function compilePattern(raw) {
	let pattern = raw;
	const dirOnly = pattern.endsWith("/");
	if (dirOnly) pattern = pattern.slice(0, -1);
	const anchored = pattern.includes("/");
	const segments = pattern.split("/");
	let body = segments.map(escapeGlob).join("/");
	if (segments[0] === "**") body = segments.length === 1 ? ".*" : `(?:.*/)?${segments.slice(1).map(escapeGlob).join("/")}`;
	if (segments.at(-1) === "**" && segments.length > 1) body = `${segments.slice(0, -1).map(escapeGlob).join("/")}(?:/.*)?`;
	return {
		pattern: `^${body.replace(/\*\*/g, () => ".*").replace(/\*/g, () => "[^/]*")}$`,
		dirOnly,
		anchored
	};
}
/** Compile the effective exclude+include pattern list once per monitor config. */
function compileIgnorePatterns(exclude, include = []) {
	const entries = [];
	for (const raw of [...DEFAULT_IGNORE_PATTERNS, ...exclude]) {
		const compiled = compilePattern(raw);
		entries.push({
			include: false,
			...compiled,
			regex: new RegExp(compiled.pattern)
		});
	}
	for (const raw of include) {
		const compiled = compilePattern(raw);
		entries.push({
			include: true,
			...compiled,
			regex: new RegExp(compiled.pattern)
		});
	}
	return new CompiledIgnore(entries);
}
/** Immutable compiled ignore set; the walker queries it per path. */
var CompiledIgnore = class {
	entries;
	constructor(entries) {
		this.entries = entries;
	}
	/**
	* Whether one workspace-relative path is ignored. Include entries win over
	* excludes (later include of an earlier excluded path re-admits it).
	* A directory pattern also excludes everything below that directory.
	* @param relPath - forward-slash relative path (may be a bare segment).
	* @param isDirectory - whether the path names a directory.
	* @returns true when the path must be skipped.
	*/
	isIgnored(relPath, isDirectory) {
		const segments = relPath.split("/");
		let verdict;
		for (const entry of this.entries) {
			let matched;
			if (entry.anchored) {
				matched = entry.regex.test(relPath);
				if (!matched && entry.dirOnly) {
					for (let depth = 1; depth < segments.length; depth += 1) if (entry.regex.test(segments.slice(0, depth).join("/"))) {
						matched = true;
						break;
					}
				}
			} else if (entry.dirOnly) matched = segments.some((segment, index) => entry.regex.test(segment) && (index < segments.length - 1 || isDirectory));
			else matched = segments.some((segment) => entry.regex.test(segment));
			if (!matched) continue;
			verdict = !entry.include;
		}
		return verdict ?? false;
	}
	/** Whether this ignore set excludes anything at all (fast path for empty trees). */
	get hasEntries() {
		return this.entries.length > 0;
	}
};
//#endregion
//#region lib/types/snapshot.js
/**
* Workspace snapshotting: a bounded walk of the workspace root recording
* per-file metadata (size, mtime, content hash, text/binary/large kind).
* The turn-start baseline retains decoded content (the disk is overwritten
* by the turn, so only the snapshot can later supply the before text); the
* turn-end view keeps metadata and hash only, and the diff engine re-reads
* changed files from disk — so the expensive retained-content path runs
* once per turn, not twice. A fast metadata-only scan supports the settle
* check.
*
* @module @deepseek-ai/dsh-change-monitor
*/
/** NUL bytes in the first probe window mark a file as binary. */
const BINARY_PROBE_BYTES = 8192;
/** Concurrent file reads inside one directory; bounds the open-handle count. */
const FILE_CONCURRENCY = 16;
/**
* Snapshot every non-ignored file under `root`. Errors on individual files
* (permission, races, encoding) are contained: the walker skips the file and
* keeps going, so one unreadable path cannot fail the turn.
* @param root - workspace root directory.
* @param options - cap, ignore set, and content-retention choice.
* @returns the snapshot, whose `files` map is never mutated afterwards.
*/
async function snapshotWorkspace(root, options) {
	const files = /* @__PURE__ */ new Map();
	const pending = [{
		dir: root,
		rel: ""
	}];
	while (pending.length > 0) {
		const { dir, rel } = pending.pop();
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		const tasks = [];
		for (const entry of entries) {
			const relPath = rel === "" ? entry.name : `${rel}/${entry.name}`;
			if (entry.isDirectory()) {
				if (entry.isSymbolicLink()) continue;
				if (options.ignore.isIgnored(relPath, true)) continue;
				pending.push({
					dir: join(dir, entry.name),
					rel: relPath
				});
				continue;
			}
			tasks.push({
				absolute: join(dir, entry.name),
				relPath
			});
		}
		for (let offset = 0; offset < tasks.length; offset += FILE_CONCURRENCY) {
			const batch = tasks.slice(offset, offset + FILE_CONCURRENCY);
			const metas = await Promise.all(batch.map((task) => metaOf(task.absolute, task.relPath, options)));
			for (let index = 0; index < batch.length; index += 1) {
				const task = batch[index];
				const meta = metas[index];
				if (task !== void 0 && meta !== void 0) files.set(task.relPath, meta);
			}
		}
	}
	return {
		root,
		time: Date.now(),
		files
	};
}
/** Snapshot one regular file, or undefined when it vanished or is unreadable. */
async function metaOf(absolute, relPath, options) {
	if (options.ignore.isIgnored(relPath, false)) return void 0;
	let info;
	try {
		info = await stat(absolute);
	} catch {
		return;
	}
	if (!info.isFile()) return void 0;
	if (info.size >= options.maxSnapshotFileSize) return {
		size: info.size,
		mtimeNs: mtimeNs$1(info),
		hash: null,
		kind: "large"
	};
	const probe = options.retainContent === false ? await hashOf(absolute, info.size) : await hashAndContent(absolute, info.size);
	return {
		size: info.size,
		mtimeNs: mtimeNs$1(info),
		hash: probe === void 0 ? null : probe.hash,
		kind: probe === void 0 ? "large" : probe.kind,
		...probe?.content === void 0 ? {} : { content: probe.content }
	};
}
/** Nanosecond mtime, with the inode fallback for filesystems without one. */
function mtimeNs$1(info) {
	if (info.mtimeNs !== void 0) return info.mtimeNs;
	return Math.floor(info.mtimeMs * 1e6);
}
/**
* Stream one file once, hashing the full content and detecting binary by NUL
* bytes in the probe window, without retaining the bytes — the cheap path for
* the turn-end view whose texts are read from disk on demand.
* @returns hash and kind, or undefined when the read failed mid-way.
*/
async function hashOf(absolute, size) {
	let handle;
	try {
		handle = await open(absolute, "r");
	} catch {
		return;
	}
	try {
		const hash = createHash("sha256");
		const buffer = Buffer.alloc(64 * 1024);
		let probed = 0;
		let binary = false;
		let position = 0;
		while (position < size) {
			const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
			if (bytesRead === 0) break;
			if (!binary && probed < BINARY_PROBE_BYTES) {
				const window = Math.min(bytesRead, BINARY_PROBE_BYTES - probed);
				if (buffer.subarray(0, window).includes(0)) binary = true;
				probed += window;
			}
			hash.update(buffer.subarray(0, bytesRead));
			position += bytesRead;
		}
		return {
			hash: hash.digest("hex"),
			kind: binary ? "binary" : "text"
		};
	} catch {
		return;
	} finally {
		await handle.close().catch(() => void 0);
	}
}
/**
* Stream one file once, detecting binary by NUL bytes in the probe window,
* hashing the full content in the same pass, and decoding text content for
* retention (the turn-start baseline path).
* @returns hash, kind, and (for text files) the decoded content, or undefined
* when the read failed mid-way.
*/
async function hashAndContent(absolute, size) {
	let handle;
	try {
		handle = await open(absolute, "r");
	} catch {
		return;
	}
	try {
		const hash = createHash("sha256");
		const chunks = [];
		const buffer = Buffer.alloc(64 * 1024);
		let probed = 0;
		let binary = false;
		let position = 0;
		while (position < size) {
			const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
			if (bytesRead === 0) break;
			if (!binary && probed < BINARY_PROBE_BYTES) {
				const window = Math.min(bytesRead, BINARY_PROBE_BYTES - probed);
				if (buffer.subarray(0, window).includes(0)) binary = true;
				probed += window;
			}
			hash.update(buffer.subarray(0, bytesRead));
			chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
			position += bytesRead;
		}
		if (binary) return {
			hash: hash.digest("hex"),
			kind: "binary"
		};
		const decoder = new TextDecoder("utf-8", { fatal: true });
		try {
			const content = decoder.decode(Buffer.concat(chunks));
			return {
				hash: hash.digest("hex"),
				kind: "text",
				content
			};
		} catch {
			return {
				hash: hash.digest("hex"),
				kind: "binary"
			};
		}
	} catch {
		return;
	} finally {
		await handle.close().catch(() => void 0);
	}
}
/**
* Fast metadata-only scan of the workspace: `relPath -> size:mtime` tokens
* without reading any content. Used to detect whether the tree has stopped
* changing after a turn ends.
*/
async function scanMetadata(root, ignore) {
	const tokens = /* @__PURE__ */ new Map();
	const pending = [{
		dir: root,
		rel: ""
	}];
	while (pending.length > 0) {
		const { dir, rel } = pending.pop();
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		const fileTasks = [];
		for (const entry of entries) {
			const relPath = rel === "" ? entry.name : `${rel}/${entry.name}`;
			if (entry.isDirectory()) {
				if (entry.isSymbolicLink()) continue;
				if (ignore.isIgnored(relPath, true)) continue;
				pending.push({
					dir: join(dir, entry.name),
					rel: relPath
				});
				continue;
			}
			if (ignore.isIgnored(relPath, false)) continue;
			fileTasks.push({
				dir,
				entry: entry.name,
				relPath
			});
		}
		for (let offset = 0; offset < fileTasks.length; offset += FILE_CONCURRENCY) {
			const batch = fileTasks.slice(offset, offset + FILE_CONCURRENCY);
			const infos = await Promise.all(batch.map((task) => stat(join(task.dir, task.entry)).catch(() => void 0)));
			for (let index = 0; index < batch.length; index += 1) {
				const task = batch[index];
				const info = infos[index];
				if (task !== void 0 && info?.isFile()) tokens.set(task.relPath, {
					size: info.size,
					mtimeNs: mtimeNs$1(info)
				});
			}
		}
	}
	return tokens;
}
/** Whether two metadata scans agree on the whole tree. */
function sameMetadata(left, right) {
	if (left.size !== right.size) return false;
	for (const [path, token] of left) {
		const other = right.get(path);
		if (other === void 0 || other.size !== token.size || other.mtimeNs !== token.mtimeNs) return false;
	}
	return true;
}
/**
* Read one file's bytes as UTF-8 text, or report it as binary/large.
* @param absolute - file path to read.
* @param maxBytes - files at or above this size are reported as `large` without reading.
* @returns decoded text, or null when the file is binary, oversized, or unreadable.
*/
async function readTextFile(absolute, maxBytes) {
	let info;
	try {
		info = await stat(absolute);
	} catch {
		return null;
	}
	if (!info.isFile()) return null;
	if (info.size >= maxBytes) return null;
	let handle;
	try {
		handle = await open(absolute, "r");
	} catch {
		return null;
	}
	try {
		const buffer = Buffer.alloc(info.size || 1);
		let position = 0;
		while (position < info.size) {
			const { bytesRead } = await handle.read(buffer, position, info.size - position, position);
			if (bytesRead === 0) break;
			position += bytesRead;
		}
		const bytes = position === buffer.length ? buffer : buffer.subarray(0, position);
		if (bytes.subarray(0, BINARY_PROBE_BYTES).includes(0)) return null;
		const decoder = new TextDecoder("utf-8", { fatal: true });
		try {
			return decoder.decode(bytes);
		} catch {
			return null;
		}
	} catch {
		return null;
	} finally {
		await handle.close().catch(() => void 0);
	}
}
/**
* The workspace's changed paths according to git — modified, added, deleted,
* and untracked files relative to HEAD, in forward-slash form. This is the
* fast path for large trees: instead of walking every file, only the git
* candidate set is snapshotted. Returns undefined when the root is not a git
* repository (or git is unavailable), which keeps the full-tree walk as the
* fallback.
* @param root - workspace root directory.
* @returns candidate paths, or undefined for non-git workspaces.
*/
async function gitChangedPaths(root) {
	if (!await hasGitRoot(root)) return void 0;
	let stdout;
	try {
		stdout = (await execFileAsync("git", [
			"status",
			"--porcelain",
			"-z",
			"--untracked-files=all"
		], {
			cwd: root,
			encoding: "utf8",
			timeout: 1e4
		})).stdout;
	} catch {
		return;
	}
	const paths = [];
	for (const entry of stdout.split("\0")) {
		if (entry === "") continue;
		let path = entry.length >= 3 ? entry.slice(3) : entry;
		const arrow = path.indexOf(" -> ");
		if (arrow !== -1) path = path.slice(arrow + 4);
		if (path !== "") paths.push(path);
	}
	return paths;
}
/**
* The current HEAD commit hash, or undefined when the repository has no
* commits or git is unavailable.
* @param root - workspace root directory.
* @returns the HEAD commit hash, or undefined.
*/
async function gitHead(root) {
	try {
		const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
			cwd: root,
			encoding: "utf8",
			timeout: 1e4
		});
		const head = stdout.trim();
		return head === "" ? void 0 : head;
	} catch {
		return;
	}
}
/**
* Paths changed between two commits (`git diff --name-status`). Renames and
* copies are reported as one entry with `oldPath`; every other change is a
* single-path entry. Returns an empty array when git fails.
* @param root - workspace root directory.
* @param from - start commit.
* @param to - end commit.
* @returns the changed-path entries.
*/
async function gitDiffNameStatus(root, from, to) {
	try {
		const { stdout } = await execFileAsync("git", [
			"diff",
			"--name-status",
			"-z",
			"--diff-filter=ACDMRT",
			from,
			to
		], {
			cwd: root,
			encoding: "utf8",
			timeout: 1e4
		});
		const tokens = stdout.split("\0");
		const entries = [];
		for (let index = 0; index < tokens.length;) {
			const status = tokens[index];
			index += 1;
			if (status === void 0 || status === "") continue;
			const code = status[0];
			if (code === "R" || code === "C") {
				const oldPath = tokens[index];
				const path = tokens[index + 1];
				index += 2;
				if (oldPath !== void 0 && path !== void 0 && path !== "") entries.push({
					kind: "renamed",
					path,
					oldPath
				});
			} else {
				const path = tokens[index];
				index += 1;
				if (path !== void 0 && path !== "") {
					const kind = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
					entries.push({
						kind,
						path
					});
				}
			}
		}
		return entries;
	} catch {
		return [];
	}
}
/**
* Read one workspace-relative path's content at a git revision, or null when
* that revision lacks the path or the content is binary.
* @param root - workspace root directory.
* @param rev - git revision (commit hash, branch, or HEAD).
* @param path - workspace-relative path.
* @returns the file's UTF-8 text, or null.
*/
async function readGitFile(root, rev, path) {
	try {
		const { stdout } = await execFileAsync("git", ["show", `${rev}:${path}`], {
			cwd: root,
			encoding: "buffer",
			timeout: 1e4
		});
		if (stdout.subarray(0, 8192).includes(0)) return null;
		return stdout.toString("utf8");
	} catch {
		return null;
	}
}
/**
* Whether `root` sits inside a git repository: walk up from the root
* looking for a `.git` directory or worktree file (bounded depth). Pure
* filesystem probes — no process spawn.
* @param root - workspace root directory.
* @returns true when a repository boundary is found.
*/
async function hasGitRoot(root) {
	let dir = root;
	for (let depth = 0; depth < 12; depth += 1) {
		try {
			const probe = await stat(join(dir, ".git"));
			if (probe.isDirectory() || probe.isFile()) return true;
		} catch {}
		const parent = dirname(dir);
		if (parent === dir) return false;
		dir = parent;
	}
	return false;
}
/**
* Snapshot only the given workspace-relative paths (the git candidate set).
* Directory entries are rejected (git status lists files, not directories,
* with `--untracked-files=all`); the walker's per-file error containment
* applies per candidate.
*
* When `before` is supplied, paths present there but absent from the
* candidate set are reconciled: a file still on disk whose content changed
* (e.g. committed mid-turn, then edited again) is re-added so the diff sees
* it; a file still on disk with unchanged content (committed mid-turn, or
* never touched) stays out; only a file gone from disk reads as deleted.
* Without this, a mid-turn commit would misreport every committed file as
* deleted (the before set holds it, the turn-end candidate set no longer
* does).
* @param root - workspace root directory.
* @param paths - candidate paths relative to the root.
* @param options - cap, ignore set, and content-retention choice.
* @param before - the turn-start snapshot whose missing paths to reconcile.
* @returns the candidate snapshot.
*/
async function snapshotCandidates(root, paths, options, before) {
	const files = /* @__PURE__ */ new Map();
	for (let offset = 0; offset < paths.length; offset += FILE_CONCURRENCY) {
		const batch = paths.slice(offset, offset + FILE_CONCURRENCY);
		const metas = await Promise.all(batch.map((path) => metaOf(join(root, path), path, options)));
		for (let index = 0; index < batch.length; index += 1) {
			const path = batch[index];
			const meta = metas[index];
			if (path !== void 0 && meta !== void 0) files.set(path, meta);
		}
	}
	if (before !== void 0) for (const [path] of before.files) {
		if (files.has(path)) continue;
		const meta = await metaOf(join(root, path), path, options);
		if (meta === void 0) continue;
		files.set(path, meta);
	}
	return {
		root,
		time: Date.now(),
		files
	};
}
/** Promisified git invocation (git status / git show). */
function execFileAsync(file, args, options) {
	return new Promise((resolve, reject) => {
		const child = spawn(file, [...args], {
			cwd: options.cwd,
			stdio: [
				"ignore",
				"pipe",
				"ignore"
			]
		});
		const chunks = [];
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, options.timeout);
		child.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});
		child.on("error", reject);
		child.on("close", (code) => {
			clearTimeout(timer);
			if (timedOut) {
				reject(/* @__PURE__ */ new Error(`git ${file} timed out`));
				return;
			}
			if (code !== 0) {
				reject(/* @__PURE__ */ new Error(`git ${file} exited ${String(code)}`));
				return;
			}
			const stdout = Buffer.concat(chunks);
			resolve({ stdout: options.encoding === "utf8" ? stdout.toString("utf8") : stdout });
		});
	});
}
//#endregion
//#region lib/types/storage.js
/**
* ChangeSet persistence: one JSONL file per session under the store root
* (default `$DSH_HOME/changes/<sessionId>.jsonl`), each line one completed
* turn's stored change set. History is trimmed to a configured maximum; the
* session-level cumulative view replays the retained records.
*
* @module @deepseek-ai/dsh-change-monitor
*/
/** Rename attempts before falling back to a direct write. */
const RENAME_ATTEMPTS = 3;
/** Delay between rename attempts, in milliseconds. */
const RENAME_RETRY_DELAY_MS = 25;
/**
* JSONL change-set store. Appends are read-modify-write under a per-session
* promise chain, so concurrent turn endings never interleave lines.
*/
var ChangeSetStore = class {
	root;
	maxHistory;
	tails = /* @__PURE__ */ new Map();
	constructor(options) {
		this.root = options.storeRoot;
		this.maxHistory = options.maxHistory;
	}
	/** The exact artifact path for one session. */
	pathOf(sessionId) {
		return join(this.root, `${sessionId}.jsonl`);
	}
	/**
	* Append one completed turn's record, trimming the file to `maxHistory`
	* turns. Never rejects the caller's turn: failures are reported by the
	* caller's best-effort wrapper.
	* @param record - the stored change set to persist.
	*/
	async append(record) {
		const path = this.pathOf(record.sessionId);
		const operation = (this.tails.get(record.sessionId) ?? Promise.resolve()).then(async () => {
			await mkdir(this.root, { recursive: true });
			const existing = await this.loadRaw(record.sessionId);
			existing.push(record);
			const content = existing.slice(-this.maxHistory).map((item) => JSON.stringify(item)).join("\n") + "\n";
			const temporary = `${path}.tmp`;
			await writeFile(temporary, content, "utf8");
			await commitFile(temporary, path);
		});
		const tail = operation.then(() => void 0, () => void 0);
		this.tails.set(record.sessionId, tail);
		await operation.finally(() => {
			if (this.tails.get(record.sessionId) === tail) this.tails.delete(record.sessionId);
		});
	}
	/**
	* Load every retained record for one session, oldest first.
	* @param sessionId - session whose history to read.
	* @returns stored change sets in chronological order (empty when absent or unreadable).
	*/
	async loadTurns(sessionId) {
		try {
			return await this.loadRaw(sessionId);
		} catch {
			return [];
		}
	}
	/** Read and parse the raw artifact; a corrupt tail line is dropped. */
	async loadRaw(sessionId) {
		const path = this.pathOf(sessionId);
		const [main, temporary] = await Promise.all([readFile(path, "utf8").catch(() => void 0), readFile(`${path}.tmp`, "utf8").catch(() => void 0)]);
		const candidates = [...parseRecords(main), ...parseRecords(temporary)];
		const seen = /* @__PURE__ */ new Set();
		const records = [];
		for (let index = candidates.length - 1; index >= 0; index -= 1) {
			const record = candidates[index];
			if (record === void 0 || seen.has(record.turn)) continue;
			seen.add(record.turn);
			records.push(record);
		}
		return records.reverse();
	}
	/**
	* The most recent retained record for one session.
	* @param sessionId - session whose latest turn to read.
	* @returns the latest record, or undefined when the session has none.
	*/
	async latest(sessionId) {
		return (await this.loadTurns(sessionId)).at(-1);
	}
	/** Sessions that have at least one retained record. */
	async listSessions() {
		try {
			return (await readdir(this.root)).filter((name) => name.endsWith(".jsonl")).map((name) => name.slice(0, -6));
		} catch {
			return [];
		}
	}
	/**
	* Remove one session's retained history. Absence is success.
	* @param sessionId - session whose artifact to delete.
	*/
	async remove(sessionId) {
		await unlink(this.pathOf(sessionId)).catch(() => void 0);
	}
};
/** One JSONL artifact's complete records; a corrupt tail line is dropped. */
function parseRecords(content) {
	if (content === void 0 || content === "") return [];
	const records = [];
	for (const line of content.split("\n")) {
		if (line === "") continue;
		try {
			records.push(JSON.parse(line));
		} catch {}
	}
	return records;
}
/**
* Atomically replace `target` with `temporary`, retrying transient failures
* (an antivirus scan or a concurrent reader can briefly lock the target on
* Windows). When every rename attempt fails, the content is written in place
* so a turn record is never lost to a lock; the temporary file is removed.
* @param temporary - fully written new content.
* @param target - existing artifact to replace.
*/
async function commitFile(temporary, target) {
	for (let attempt = 0; attempt < RENAME_ATTEMPTS; attempt += 1) try {
		await rename(temporary, target);
		return;
	} catch (error) {
		if (attempt === RENAME_ATTEMPTS - 1) {
			await writeFile(target, await readFile(temporary, "utf8"), "utf8");
			await unlink(temporary).catch(() => void 0);
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_DELAY_MS));
	}
}
/** Wire summary of one stored change set (no hunks, no retained content). */
function summarizeChangeSet(record) {
	const files = record.files.map((file) => ({
		path: file.path,
		status: file.status,
		kind: file.kind,
		additions: file.additions,
		deletions: file.deletions,
		beforeSize: file.beforeSize,
		afterSize: file.afterSize,
		...file.summary === void 0 ? {} : { summary: file.summary }
	}));
	return {
		sessionId: record.sessionId,
		turn: record.turn,
		startedAt: record.startedAt,
		finishedAt: record.finishedAt,
		root: record.root,
		files,
		additions: record.additions,
		deletions: record.deletions
	};
}
/** One history row for the panel. */
function summarizeTurn(record) {
	return {
		turn: record.turn,
		startedAt: record.startedAt,
		finishedAt: record.finishedAt,
		filesCount: record.files.length,
		additions: record.additions,
		deletions: record.deletions
	};
}
/**
* Cumulative changes across every retained turn of one session: for each
* file, the earliest retained before-state against the latest retained
* after-state. A file that ended identical to its session baseline is
* dropped, matching the per-turn unchanged rule.
* @param turns - retained records, oldest first.
* @returns the merged summary, or null when nothing changed cumulatively.
*/
function mergeSessionChangeSets(turns) {
	if (turns.length === 0) return null;
	const states = /* @__PURE__ */ new Map();
	for (const turn of turns) for (const file of turn.files) {
		let state = states.get(file.path);
		if (state === void 0) {
			state = {
				baseline: file.status === "added" ? null : file.beforeContent ?? null,
				final: null
			};
			states.set(file.path, state);
		}
		state.final = file.status === "deleted" ? null : file.afterContent ?? null;
	}
	const files = [];
	let additions = 0;
	let deletions = 0;
	for (const [path, state] of states) {
		const before = state.baseline ?? "";
		const after = state.final ?? "";
		if (before === after) continue;
		const status = state.final === null ? "deleted" : state.baseline === null ? "added" : "modified";
		const diff = diffText(before, after, {
			contextLines: 5,
			maxCells: DEFAULT_MAX_DIFF_CELLS
		});
		additions += diff.additions;
		deletions += diff.deletions;
		files.push({
			path,
			status,
			kind: "text",
			additions: diff.additions,
			deletions: diff.deletions,
			beforeSize: Buffer.byteLength(before, "utf8"),
			afterSize: Buffer.byteLength(after, "utf8")
		});
	}
	if (files.length === 0) return null;
	const first = turns[0];
	const last = turns[turns.length - 1];
	return {
		sessionId: last.sessionId,
		turn: last.turn,
		startedAt: first.startedAt,
		finishedAt: last.finishedAt,
		root: last.root,
		files,
		additions,
		deletions
	};
}
/** The stored file change whose content belongs to one record (read helper). */
function storedFileOf(record, path) {
	return record.files.find((file) => file.path === path);
}
//#endregion
//#region lib/types/index.js
/**
* Per-turn file-change monitor: observes `session/event` for `turn/start` and
* `turn/end`, snapshots the session workspace around each turn, diffs the two
* snapshots at turn end, and persists the resulting change set. Exposes the
* changeMonitor Remote namespace to the Web Client.
*
* The monitor is strictly best-effort: any failure inside snapshotting,
* diffing, or storage is logged as a warning and never affects the agent
* turn. Diff results are always computed from the turn's own before/after
* snapshots, never from later disk state, so each turn's panel shows exactly
* what that turn changed — including files the agent wrote and later restored
* (those end up hash-equal and are reported as unchanged).
*
* @module @deepseek-ai/dsh-change-monitor
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Default per-file cap for hashing and diffing (10 MiB). */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Default stability wait between turn end and the final snapshot. */
const DEFAULT_SETTLE_DELAY_MS = 200;
/** Default settle re-scan attempts before giving up on stability. */
const DEFAULT_SETTLE_MAX_ATTEMPTS = 5;
/** Default turns retained per session in the history store. */
const DEFAULT_MAX_HISTORY = 100;
/** Validate one positive integer knob at the configuration boundary. */
function resolvePositive(value, fallback, name) {
	if (value === void 0) return fallback;
	if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`change-monitor: ${name} must be a positive safe integer, got ${String(value)}`);
	return value;
}
/** Validate one non-negative integer knob (delays and context lines allow 0). */
function resolveNonNegative(value, fallback, name) {
	if (value === void 0) return fallback;
	if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`change-monitor: ${name} must be a non-negative safe integer, got ${String(value)}`);
	return value;
}
/**
* The per-turn change monitor service. Listens to the durable session event
* stream — `turn/start` opens a before snapshot, `turn/end` settles, re-scans
* for stability, snapshots after, diffs, and stores. All of it runs inside
* contained best-effort wrappers.
*/
let ChangeMonitorService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _turns_decorators;
	let _current_decorators;
	let _debug_decorators;
	let _turn_decorators;
	let _file_decorators;
	let _session_decorators;
	return class ChangeMonitorService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_turns_decorators = [Remote("turns")];
			_current_decorators = [Remote("current")];
			_debug_decorators = [Remote("debug")];
			_turn_decorators = [Remote("turn")];
			_file_decorators = [Remote("file")];
			_session_decorators = [Remote("session")];
			__esDecorate(this, null, _turns_decorators, {
				kind: "method",
				name: "turns",
				static: false,
				private: false,
				access: {
					has: (obj) => "turns" in obj,
					get: (obj) => obj.turns
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _current_decorators, {
				kind: "method",
				name: "current",
				static: false,
				private: false,
				access: {
					has: (obj) => "current" in obj,
					get: (obj) => obj.current
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _debug_decorators, {
				kind: "method",
				name: "debug",
				static: false,
				private: false,
				access: {
					has: (obj) => "debug" in obj,
					get: (obj) => obj.debug
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _turn_decorators, {
				kind: "method",
				name: "turn",
				static: false,
				private: false,
				access: {
					has: (obj) => "turn" in obj,
					get: (obj) => obj.turn
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _file_decorators, {
				kind: "method",
				name: "file",
				static: false,
				private: false,
				access: {
					has: (obj) => "file" in obj,
					get: (obj) => obj.file
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _session_decorators, {
				kind: "method",
				name: "session",
				static: false,
				private: false,
				access: {
					has: (obj) => "session" in obj,
					get: (obj) => obj.session
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static Config = z.object({
			enabled: z.boolean().default(true),
			exclude: z.array(z.string()).default([]),
			include: z.array(z.string()).default([]),
			maxSnapshotFileSize: z.number().step(1).min(1).default(DEFAULT_MAX_FILE_SIZE),
			maxDiffFileSize: z.number().step(1).min(1).default(DEFAULT_MAX_FILE_SIZE),
			maxDiffCells: z.number().step(1).min(1).default(DEFAULT_MAX_DIFF_CELLS),
			contextLines: z.number().step(1).min(0).default(5),
			settleDelayMs: z.number().step(1).min(0).default(200),
			settleMaxAttempts: z.number().step(1).min(1).default(5),
			historyEnabled: z.boolean().default(true),
			maxHistory: z.number().step(1).min(1).default(100),
			storeRoot: z.string()
		});
		config = __runInitializers(this, _instanceExtraInitializers);
		ignore;
		store;
		states = /* @__PURE__ */ new Map();
		/**
		* Latest completed turn's summary per live session (the wire `current`
		* value without retained content). One small entry per session, dropped on
		* disposal; the full record lives only on disk.
		*/
		latest = /* @__PURE__ */ new Map();
		/** Diagnostic ring: recent turn events, for runtime verification. */
		eventLog = [];
		/**
		* @param ctx - host context carrying the session event feed.
		* @param config - plugin configuration (defaults apply).
		*/
		constructor(ctx, config = {}) {
			super(ctx, "changeMonitor");
			this.config = {
				enabled: config.enabled ?? true,
				exclude: config.exclude ?? [],
				include: config.include ?? [],
				maxSnapshotFileSize: resolvePositive(config.maxSnapshotFileSize, DEFAULT_MAX_FILE_SIZE, "maxSnapshotFileSize"),
				maxDiffFileSize: resolvePositive(config.maxDiffFileSize, DEFAULT_MAX_FILE_SIZE, "maxDiffFileSize"),
				maxDiffCells: resolvePositive(config.maxDiffCells, DEFAULT_MAX_DIFF_CELLS, "maxDiffCells"),
				contextLines: resolveNonNegative(config.contextLines, 5, "contextLines"),
				settleDelayMs: resolveNonNegative(config.settleDelayMs, 200, "settleDelayMs"),
				settleMaxAttempts: resolvePositive(config.settleMaxAttempts, 5, "settleMaxAttempts"),
				historyEnabled: config.historyEnabled ?? true,
				maxHistory: resolvePositive(config.maxHistory, 100, "maxHistory"),
				storeRoot: config.storeRoot ?? dshHomePath("changes")
			};
			this.ignore = compileIgnorePatterns(this.config.exclude, this.config.include);
			this.store = new ChangeSetStore({
				storeRoot: this.config.storeRoot,
				maxHistory: this.config.maxHistory
			});
			ctx.on("session/event", (session, event) => {
				if (!this.config.enabled) return;
				if (event.type === "turn/start" || event.type === "turn/end" || event.type === "session/end-seed") {
					this.eventLog.push({
						time: Date.now(),
						session: session.id,
						type: event.type,
						turn: event.data.turn ?? 0
					});
					if (this.eventLog.length > 40) this.eventLog.shift();
				}
				if (event.type === "turn/start") this.onTurnStart(session, event.data.turn);
				else if (event.type === "turn/end") this.onTurnEnd(session, event.data.turn);
			});
			ctx.on("session/disposed", (session) => {
				this.states.delete(session.id);
				this.latest.delete(session.id);
			});
		}
		/** Best-effort wrapper: one failure logs a warning and never throws. */
		bestEffort(label, operation) {
			operation().catch((error) => {
				this.ctx.logger.warn(`change monitor ${label} failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
			});
		}
		/** Snapshot the workspace at turn start; the diff needs this baseline. */
		onTurnStart(session, turn) {
			const cwd = session.header.cwd;
			if (cwd === void 0) return;
			const bookkeeping = {
				turn,
				before: void 0,
				beforeReady: Promise.resolve(),
				busy: Promise.resolve(),
				git: false
			};
			this.states.set(session.id, bookkeeping);
			bookkeeping.beforeReady = (async () => {
				const candidates = await gitChangedPaths(cwd);
				bookkeeping.git = candidates !== void 0;
				if (candidates !== void 0) {
					const head = await gitHead(cwd);
					if (head !== void 0) bookkeeping.startHead = head;
				}
				bookkeeping.before = candidates === void 0 ? await snapshotWorkspace(cwd, {
					maxSnapshotFileSize: this.config.maxSnapshotFileSize,
					ignore: this.ignore
				}) : await snapshotCandidates(cwd, candidates, {
					maxSnapshotFileSize: this.config.maxSnapshotFileSize,
					ignore: this.ignore
				});
			})().then(() => void 0, (error) => {
				this.ctx.logger.warn(`change monitor turn ${turn} before snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		}
		/** Settle, snapshot after, diff, and store — serialized per session. */
		onTurnEnd(session, turn) {
			const cwd = session.header.cwd;
			if (cwd === void 0) return;
			const bookkeeping = this.states.get(session.id);
			if (bookkeeping === void 0 || bookkeeping.turn !== turn) return;
			bookkeeping.busy = bookkeeping.busy.then(async () => {
				try {
					await this.settleAndDiff(session.id, cwd, bookkeeping);
				} finally {
					bookkeeping.before = void 0;
					if (this.states.get(session.id) === bookkeeping) this.states.delete(session.id);
				}
			});
			this.bestEffort(`turn ${turn} settle/diff`, () => bookkeeping.busy);
		}
		/** Wait for quiescence, snapshot, diff, persist, and cache. */
		async settleAndDiff(sessionId, root, bookkeeping) {
			if (!this.config.enabled) {
				this.eventLog.push({
					time: Date.now(),
					session: sessionId,
					type: "debug/disabled",
					turn: bookkeeping.turn
				});
				return;
			}
			await bookkeeping.beforeReady;
			const before = bookkeeping.before;
			if (before === void 0) {
				this.eventLog.push({
					time: Date.now(),
					session: sessionId,
					type: "debug/no-before",
					turn: bookkeeping.turn
				});
				this.ctx.logger.warn(`change monitor: turn ${bookkeeping.turn} has no before snapshot; skipping`);
				return;
			}
			let after;
			if (bookkeeping.git) {
				const candidates = await gitChangedPaths(root) ?? [];
				await this.waitForStability(root, candidates);
				let afterMerged = await snapshotCandidates(root, candidates, {
					maxSnapshotFileSize: this.config.maxSnapshotFileSize,
					ignore: this.ignore,
					retainContent: false
				}, before);
				let beforeMerged = before;
				if (bookkeeping.startHead !== void 0) {
					const committed = await gitDiffNameStatus(root, bookkeeping.startHead, "HEAD");
					if (committed.length > 0) {
						afterMerged = await this.mergeCommittedAfter(root, afterMerged, committed);
						beforeMerged = await this.mergeCommittedBefore(root, beforeMerged, committed, bookkeeping.startHead);
					}
				}
				beforeMerged = await this.backfillHeadBefore(root, beforeMerged, afterMerged, bookkeeping.startHead);
				const record = await this.buildChangeSet(sessionId, bookkeeping.turn, beforeMerged, afterMerged);
				this.latest.set(sessionId, summarizeChangeSet(record));
				this.eventLog.push({
					time: Date.now(),
					session: sessionId,
					type: "debug/stored",
					turn: bookkeeping.turn
				});
				if (this.config.historyEnabled) await this.store.append(record);
				return;
			} else {
				await this.waitForStability(root);
				after = await snapshotWorkspace(root, {
					maxSnapshotFileSize: this.config.maxSnapshotFileSize,
					ignore: this.ignore,
					retainContent: false
				});
			}
			const record = await this.buildChangeSet(sessionId, bookkeeping.turn, before, after);
			this.latest.set(sessionId, summarizeChangeSet(record));
			this.eventLog.push({
				time: Date.now(),
				session: sessionId,
				type: "debug/stored",
				turn: bookkeeping.turn
			});
			if (this.config.historyEnabled) await this.store.append(record);
		}
		/**
		* Re-scan until the tree's metadata stops changing, bounded by attempts.
		* The git-candidate variant checks only the changed-path set (seconds on
		* huge trees); the full-tree variant walks everything.
		* @param root - workspace root.
		* @param candidates - git candidate paths (undefined = full-tree scan).
		*/
		async waitForStability(root, candidates) {
			await delay(this.config.settleDelayMs);
			for (let attempt = 0; attempt < this.config.settleMaxAttempts; attempt += 1) {
				const first = candidates !== void 0 ? await candidateTokens(root, candidates) : await scanMetadata(root, this.ignore);
				await delay(this.config.settleDelayMs);
				const second = candidates !== void 0 ? await candidateTokens(root, candidates) : await scanMetadata(root, this.ignore);
				if (candidates !== void 0 ? sameTokens(first, second) : sameMetadata(first, second)) return;
			}
		}
		/**
		* Backfill before-snapshots for after-side paths absent from the before
		* snapshot: a file clean at turn start that the turn modified but did not
		* commit. Its turn-start content is exactly the turn-start git revision, so
		* `git show` supplies it; untracked new files (absent from that revision
		* too) stay before-less and the diff reports them as added.
		* @param root - workspace root.
		* @param before - the turn-start snapshot (read-only).
		* @param after - the turn-end candidate snapshot.
		* @param startHead - the git revision at turn start; falls back to HEAD.
		* @returns the before snapshot with the backfilled entries.
		*/
		async backfillHeadBefore(root, before, after, startHead) {
			const missing = [...after.files.keys()].filter((path) => !before.files.has(path));
			if (missing.length === 0) return before;
			const rev = startHead ?? "HEAD";
			const merged = new Map(before.files);
			for (const path of missing) {
				const text = await readGitFile(root, rev, path);
				if (text === null) continue;
				merged.set(path, {
					size: Buffer.byteLength(text, "utf8"),
					mtimeNs: 0,
					hash: createHash("sha256").update(text).digest("hex"),
					kind: "text",
					content: text
				});
			}
			return {
				...before,
				files: merged
			};
		}
		/**
		* Add committed added/modified/renamed paths to the after snapshot from
		* disk, so a clean-at-turn-start file that was committed mid-turn still
		* appears in the diff. Deleted paths stay absent and are represented on the
		* before side only.
		* @param root - workspace root.
		* @param after - the turn-end candidate snapshot.
		* @param committed - paths changed between turn-start HEAD and current HEAD.
		* @returns the after snapshot with committed paths added.
		*/
		async mergeCommittedAfter(root, after, committed) {
			const files = new Map(after.files);
			let changed = false;
			for (const entry of committed) {
				if (entry.kind === "deleted") continue;
				if (files.has(entry.path)) continue;
				const meta = (await snapshotCandidates(root, [entry.path], {
					maxSnapshotFileSize: this.config.maxSnapshotFileSize,
					ignore: this.ignore,
					retainContent: false
				})).files.get(entry.path);
				if (meta !== void 0) {
					files.set(entry.path, meta);
					changed = true;
				}
			}
			return changed ? {
				root,
				time: after.time,
				files
			} : after;
		}
		/**
		* Add committed deleted/modified/renamed-old paths to the before snapshot
		* from the turn-start git revision, so the diff can report them as deleted
		* or modified. Added paths stay absent because they did not exist at turn
		* start.
		* @param root - workspace root.
		* @param before - the turn-start snapshot (read-only).
		* @param committed - paths changed between turn-start HEAD and current HEAD.
		* @param startHead - the git revision at turn start.
		* @returns the before snapshot with committed paths added.
		*/
		async mergeCommittedBefore(root, before, committed, startHead) {
			const files = new Map(before.files);
			let changed = false;
			for (const entry of committed) {
				if (entry.kind === "added") continue;
				const path = entry.kind === "renamed" ? entry.oldPath : entry.path;
				if (path === void 0 || files.has(path) || this.ignore.isIgnored(path, false)) continue;
				const text = await readGitFile(root, startHead, path);
				if (text === null) continue;
				files.set(path, {
					size: Buffer.byteLength(text, "utf8"),
					mtimeNs: 0,
					hash: createHash("sha256").update(text).digest("hex"),
					kind: "text",
					content: text
				});
				changed = true;
			}
			return changed ? {
				...before,
				files
			} : before;
		}
		/** Compute the stored change set from the before/after snapshots. */
		async buildChangeSet(sessionId, turn, before, after) {
			const allPaths = new Set([...before.files.keys(), ...after.files.keys()]);
			const files = [];
			let additions = 0;
			let deletions = 0;
			for (const path of [...allPaths].sort()) {
				const beforeMeta = before.files.get(path);
				const afterMeta = after.files.get(path);
				const file = await this.buildFileChange(path, beforeMeta, afterMeta, after.root);
				if (file === void 0) continue;
				additions += file.additions;
				deletions += file.deletions;
				files.push(file);
			}
			return {
				sessionId,
				turn,
				startedAt: before.time,
				finishedAt: after.time,
				root: after.root,
				files,
				additions,
				deletions
			};
		}
		/**
		* Diff one path's before/after states, or undefined when unchanged. The
		* before text comes from the retained turn-start snapshot; the after text
		* is read from disk at diff time (the after view holds hashes only).
		*/
		async buildFileChange(path, beforeMeta, afterMeta, root) {
			const afterText = afterMeta !== void 0 && (beforeMeta === void 0 || beforeMeta.hash === null || beforeMeta.hash !== afterMeta.hash) ? await readTextFile(join(root, path), this.config.maxDiffFileSize) : void 0;
			if (beforeMeta !== void 0 && afterMeta !== void 0) {
				if (beforeMeta.hash !== null && afterMeta.hash !== null && beforeMeta.hash === afterMeta.hash) return;
				if (beforeMeta.hash === null && afterMeta.hash === null && beforeMeta.size === afterMeta.size) return;
				const beforeText = beforeMeta.content;
				if (beforeText !== void 0 && afterText !== null && afterText !== void 0) {
					if (beforeText === afterText) return void 0;
					const diff = diffText(beforeText, afterText, {
						contextLines: this.config.contextLines,
						maxCells: this.config.maxDiffCells
					});
					return {
						path,
						status: "modified",
						kind: "text",
						additions: diff.additions,
						deletions: diff.deletions,
						beforeSize: beforeMeta.size,
						afterSize: afterMeta.size,
						hunks: diff.hunks,
						beforeContent: beforeText,
						afterContent: afterText
					};
				}
				return {
					path,
					status: "modified",
					kind: afterMeta.kind === "text" && beforeMeta.kind === "text" ? "large" : "binary",
					additions: 0,
					deletions: 0,
					beforeSize: beforeMeta.size,
					afterSize: afterMeta.size,
					hunks: [],
					summary: "Binary file changed"
				};
			}
			if (afterMeta !== void 0) {
				if (afterText !== null && afterText !== void 0) {
					const diff = diffText("", afterText, {
						contextLines: this.config.contextLines,
						maxCells: this.config.maxDiffCells
					});
					return {
						path,
						status: "added",
						kind: "text",
						additions: diff.additions,
						deletions: 0,
						beforeSize: 0,
						afterSize: afterMeta.size,
						hunks: diff.hunks,
						afterContent: afterText
					};
				}
				return {
					path,
					status: "added",
					kind: afterMeta.kind,
					additions: 0,
					deletions: 0,
					beforeSize: 0,
					afterSize: afterMeta.size,
					hunks: [],
					summary: "Binary file changed"
				};
			}
			const beforeText = beforeMeta?.content;
			if (beforeMeta !== void 0 && beforeText !== void 0) {
				const diff = diffText(beforeText, "", {
					contextLines: this.config.contextLines,
					maxCells: this.config.maxDiffCells
				});
				return {
					path,
					status: "deleted",
					kind: "text",
					additions: 0,
					deletions: diff.deletions,
					beforeSize: beforeMeta.size,
					afterSize: 0,
					hunks: diff.hunks,
					beforeContent: beforeText
				};
			}
			return {
				path,
				status: "deleted",
				kind: beforeMeta?.kind ?? "binary",
				additions: 0,
				deletions: 0,
				beforeSize: beforeMeta?.size ?? 0,
				afterSize: 0,
				hunks: [],
				summary: "Binary file changed"
			};
		}
		/**
		* `changeMonitor.turns`: completed turns, newest first.
		* @param request - session whose history to read.
		* @returns turn summaries or a structured failure.
		*/
		async turns(request) {
			return await this.guard(async () => {
				return {
					ok: true,
					value: (await this.store.loadTurns(request.sessionId)).map(summarizeTurn).reverse()
				};
			});
		}
		/**
		* `changeMonitor.current`: the latest completed turn's summary.
		* @param request - session whose latest turn to read.
		* @returns the summary, or null when the session has no completed turn.
		*/
		async current(request) {
			return await this.guard(async () => {
				const cached = this.latest.get(request.sessionId);
				if (cached !== void 0) return {
					ok: true,
					value: cached
				};
				const record = await this.store.latest(request.sessionId);
				return {
					ok: true,
					value: record === void 0 ? null : summarizeChangeSet(record)
				};
			});
		}
		/**
		* `changeMonitor.debug`: recent session/event arrivals (diagnostic surface).
		* @returns the last received turn events with timestamps.
		*/
		async debug() {
			return {
				ok: true,
				value: [...this.eventLog]
			};
		}
		/**
		* `changeMonitor.turn`: one exact completed turn's summary.
		* @param request - session and turn number.
		* @returns the summary, or null when that turn has no record.
		*/
		async turn(request) {
			return await this.guard(async () => {
				const record = await this.findTurn(request.sessionId, request.turn);
				return {
					ok: true,
					value: record === void 0 ? null : summarizeChangeSet(record)
				};
			});
		}
		/**
		* `changeMonitor.file`: one file's full diff inside one turn. The path must
		* be a safe workspace-relative path; anything else is `invalid-path`.
		* @param request - session, turn, and workspace-relative path.
		* @returns the file's complete change record with hunks.
		*/
		async file(request) {
			return await this.guard(async () => {
				const record = await this.findTurn(request.sessionId, request.turn);
				if (record === void 0) return {
					ok: false,
					error: {
						code: "not-found",
						message: `turn ${request.turn} has no record`
					}
				};
				const stored = storedFileOf(record, request.path);
				if (stored === void 0) return {
					ok: false,
					error: {
						code: "not-found",
						message: `file ${JSON.stringify(request.path)} is not in turn ${request.turn}`
					}
				};
				return {
					ok: true,
					value: withoutContent(stored)
				};
			});
		}
		/**
		* `changeMonitor.session`: cumulative changes across every retained turn.
		* @param request - session whose cumulative changes to read.
		* @returns the merged summary, or null when nothing changed net.
		*/
		async session(request) {
			return await this.guard(async () => {
				return {
					ok: true,
					value: mergeSessionChangeSets(await this.store.loadTurns(request.sessionId))
				};
			});
		}
		/** Find one stored turn record. */
		async findTurn(sessionId, turn) {
			return (await this.store.loadTurns(sessionId)).find((record) => record.turn === turn);
		}
		/** Contain a Remote operation: failures become structured `internal` errors. */
		async guard(operation) {
			try {
				return await operation();
			} catch (error) {
				return {
					ok: false,
					error: {
						code: "internal",
						message: error instanceof Error ? error.message : String(error)
					}
				};
			}
		}
	};
})();
/** Strip retained content from a stored file change for the wire. */
function withoutContent(file) {
	return {
		path: file.path,
		status: file.status,
		kind: file.kind,
		additions: file.additions,
		deletions: file.deletions,
		beforeSize: file.beforeSize,
		afterSize: file.afterSize,
		hunks: file.hunks,
		...file.summary === void 0 ? {} : { summary: file.summary }
	};
}
/** One-shot delay; the monitor's best-effort wrapper tolerates teardown races. */
function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
/**
* Stability tokens for the git candidate set only — stat each candidate
* (bounded concurrency), so the settle check costs seconds even when the
* workspace holds tens of thousands of files.
* @param root - workspace root.
* @param candidates - candidate paths.
* @returns path -> token map; unreadable paths are absent.
*/
async function candidateTokens(root, candidates) {
	const tokens = /* @__PURE__ */ new Map();
	const CONCURRENCY = 32;
	for (let offset = 0; offset < candidates.length; offset += CONCURRENCY) {
		const batch = candidates.slice(offset, offset + CONCURRENCY);
		const infos = await Promise.all(batch.map((path) => stat(join(root, path)).catch(() => void 0)));
		for (let index = 0; index < batch.length; index += 1) {
			const path = batch[index];
			const info = infos[index];
			if (path !== void 0 && info?.isFile()) tokens.set(path, {
				size: info.size,
				mtimeNs: mtimeNs(info)
			});
		}
	}
	return tokens;
}
/** Whether two candidate token maps agree. */
function sameTokens(left, right) {
	if (left.size !== right.size) return false;
	for (const [path, token] of left) {
		const other = right.get(path);
		if (other === void 0 || other.size !== token.size || other.mtimeNs !== token.mtimeNs) return false;
	}
	return true;
}
/** Nanosecond mtime, with the millisecond fallback for odd filesystems. */
function mtimeNs(info) {
	if (info.mtimeNs !== void 0) return info.mtimeNs;
	return Math.floor(info.mtimeMs * 1e6);
}
//#endregion
export { ChangeMonitorService, ChangeMonitorService as default, ChangeSetStore, DEFAULT_IGNORE_PATTERNS, DEFAULT_MAX_FILE_SIZE, DEFAULT_MAX_HISTORY, DEFAULT_SETTLE_DELAY_MS, DEFAULT_SETTLE_MAX_ATTEMPTS, compileIgnorePatterns, diffText, mergeSessionChangeSets, readTextFile, sameMetadata, scanMetadata, snapshotWorkspace, summarizeChangeSet, summarizeTurn };
