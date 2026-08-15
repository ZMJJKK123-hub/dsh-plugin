var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : /* @__PURE__ */ Symbol.for("Symbol." + name);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name]() {
    return __privateGet(this, extra);
  }, set [name](x) {
    return __privateSet(this, extra, x);
  } }, name));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name) : __name(target, name);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name, desc), p ? k ^ 4 ? extra : desc : target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// packages/session/change-monitor/src/index.ts
import z from "@deepseek-ai/schemastery";
import { createHash as createHash2 } from "node:crypto";
import { stat as stat2 } from "node:fs/promises";
import { join as join3 } from "node:path";
import { dshHomePath } from "@deepseek-ai/dsh-home-paths";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

// packages/session/change-monitor/src/diff.ts
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
function editScript(before, after, maxCells) {
  let prefix = 0;
  const common = Math.min(before.length, after.length);
  while (prefix < common && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < common - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) {
    suffix += 1;
  }
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
  for (let offset = 0; offset <= probe; offset += 1) {
    for (const index of offset === 0 ? [mid] : [mid - offset, mid + offset]) {
      if (index < 0 || index >= n) continue;
      const positions = afterIndex.get(before[index]);
      if (positions === void 0 || positions.length === 0) continue;
      const afterIndex2 = positions.reduce((closest, position) => Math.abs(position - m / 2) < Math.abs(closest - m / 2) ? position : closest, positions[0]);
      const left = diffMiddle(before.slice(0, index), after.slice(0, afterIndex2), maxCells);
      const right = diffMiddle(before.slice(index + 1), after.slice(afterIndex2 + 1), maxCells);
      return [...left, "keep", ...right];
    }
  }
  return [...before.map(() => "del"), ...after.map(() => "add")];
}
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
  for (let i2 = 1; i2 <= n; i2 += 1) {
    const beforeLine = before[i2 - 1];
    for (let j2 = 1; j2 <= m; j2 += 1) {
      const cell = i2 * width + j2;
      const diag = (i2 - 1) * width + (j2 - 1);
      const up = (i2 - 1) * width + j2;
      const left = i2 * width + (j2 - 1);
      if (beforeLine === after[j2 - 1]) table[cell] = table[diag] + 1;
      else table[cell] = Math.max(table[up], table[left]);
    }
  }
  let i = n;
  let j = m;
  const traced = [];
  while (i > 0 && j > 0) {
    if (before[i - 1] === after[j - 1]) {
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
      positions.push({ index, oldLine, newLine });
      newLine += 1;
      additions += 1;
    } else if (op === "del") {
      positions.push({ index, oldLine, newLine });
      oldLine += 1;
      deletions += 1;
    } else {
      oldLine += 1;
      newLine += 1;
    }
  });
  if (positions.length === 0) return { hunks: [], additions, deletions };
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
  const hunks = groups.map((changes) => {
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
      if (index >= start) {
        if (op === "add") {
          lines.push({ kind: "add", oldLine: null, newLine: newNumber, text });
        } else if (op === "del") {
          lines.push({ kind: "del", oldLine: old, newLine: null, text });
        } else {
          lines.push({ kind: "context", oldLine: old, newLine: newNumber, text });
        }
      }
      if (op === "add") newNumber += 1;
      else if (op === "del") old += 1;
      else {
        old += 1;
        newNumber += 1;
      }
    }
    const hunkOldStart = oldForIndex(start, ops, beforeLines.length);
    const hunkNewStart = newForIndex(start, ops, afterLines.length);
    const oldCount = lines.reduce((count, line) => count + (line.kind === "del" || line.kind === "context" ? 1 : 0), 0);
    const newCount = lines.reduce((count, line) => count + (line.kind === "add" || line.kind === "context" ? 1 : 0), 0);
    return {
      oldStart: hunkOldStart,
      oldLines: oldCount,
      newStart: hunkNewStart,
      newLines: newCount,
      lines
    };
  });
  return { hunks, additions, deletions };
}
function oldForIndex(index, ops, totalBefore) {
  let old = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (ops[cursor] !== "add") old += 1;
  }
  return old > totalBefore ? Math.max(1, totalBefore) : old;
}
function newForIndex(index, ops, totalAfter) {
  let newNumber = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (ops[cursor] !== "del") newNumber += 1;
  }
  return newNumber > totalAfter ? Math.max(1, totalAfter) : newNumber;
}
var DEFAULT_CONTEXT_LINES = 5;
var DEFAULT_MAX_DIFF_CELLS = 25e6;

// packages/session/change-monitor/src/ignore.ts
var DEFAULT_IGNORE_PATTERNS = [
  // Directories.
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
  // File shapes.
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
function escapeGlob(source) {
  let out = "";
  for (const char of source) {
    if (char === "*") out += "*";
    else if (char === "?") out += "?";
    else out += /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
  }
  return out;
}
function compilePattern(raw) {
  let pattern = raw;
  const dirOnly = pattern.endsWith("/");
  if (dirOnly) pattern = pattern.slice(0, -1);
  const anchored = pattern.includes("/");
  const segments = pattern.split("/");
  let body = segments.map(escapeGlob).join("/");
  if (segments[0] === "**") {
    body = segments.length === 1 ? ".*" : `(?:.*/)?${segments.slice(1).map(escapeGlob).join("/")}`;
  }
  if (segments.at(-1) === "**" && segments.length > 1) {
    body = `${segments.slice(0, -1).map(escapeGlob).join("/")}(?:/.*)?`;
  }
  const translated = body.replace(/\*\*/g, () => ".*").replace(/\*/g, () => "[^/]*");
  return { pattern: `^${translated}$`, dirOnly, anchored };
}
function compileIgnorePatterns(exclude, include = []) {
  const entries = [];
  for (const raw of [...DEFAULT_IGNORE_PATTERNS, ...exclude]) {
    const compiled = compilePattern(raw);
    entries.push({ include: false, ...compiled, regex: new RegExp(compiled.pattern) });
  }
  for (const raw of include) {
    const compiled = compilePattern(raw);
    entries.push({ include: true, ...compiled, regex: new RegExp(compiled.pattern) });
  }
  return new CompiledIgnore(entries);
}
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
          for (let depth = 1; depth < segments.length; depth += 1) {
            if (entry.regex.test(segments.slice(0, depth).join("/"))) {
              matched = true;
              break;
            }
          }
        }
      } else if (entry.dirOnly) {
        matched = segments.some((segment, index) => entry.regex.test(segment) && (index < segments.length - 1 || isDirectory));
      } else {
        matched = segments.some((segment) => entry.regex.test(segment));
      }
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

// packages/session/change-monitor/src/snapshot.ts
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, open, readdir, stat } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
var BINARY_PROBE_BYTES = 8192;
var FILE_CONCURRENCY = 16;
async function snapshotWorkspace(root, options) {
  const files = /* @__PURE__ */ new Map();
  const pending = [{ dir: root, rel: "" }];
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
        pending.push({ dir: join(dir, entry.name), rel: relPath });
        continue;
      }
      tasks.push({ absolute: join(dir, entry.name), relPath });
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
  return { root, time: Date.now(), files };
}
async function metaOf(absolute, relPath, options) {
  if (options.ignore.isIgnored(relPath, false)) return void 0;
  let info;
  try {
    info = await stat(absolute);
  } catch {
    return void 0;
  }
  if (!info.isFile()) return void 0;
  if (info.size >= options.maxSnapshotFileSize) {
    return { size: info.size, mtimeNs: mtimeNs(info), hash: null, kind: "large" };
  }
  const probe = options.retainContent === false ? await hashOf(absolute, info.size) : await hashAndContent(absolute, info.size);
  return {
    size: info.size,
    mtimeNs: mtimeNs(info),
    hash: probe === void 0 ? null : probe.hash,
    kind: probe === void 0 ? "large" : probe.kind,
    ...probe?.content === void 0 ? {} : { content: probe.content }
  };
}
function mtimeNs(info) {
  if (info.mtimeNs !== void 0) return info.mtimeNs;
  return Math.floor(info.mtimeMs * 1e6);
}
async function hashOf(absolute, size) {
  let handle;
  try {
    handle = await open(absolute, "r");
  } catch {
    return void 0;
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
    return { hash: hash.digest("hex"), kind: binary ? "binary" : "text" };
  } catch {
    return void 0;
  } finally {
    await handle.close().catch(() => void 0);
  }
}
async function hashAndContent(absolute, size) {
  let handle;
  try {
    handle = await open(absolute, "r");
  } catch {
    return void 0;
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
    if (binary) return { hash: hash.digest("hex"), kind: "binary" };
    const decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      const content = decoder.decode(Buffer.concat(chunks));
      return { hash: hash.digest("hex"), kind: "text", content };
    } catch {
      return { hash: hash.digest("hex"), kind: "binary" };
    }
  } catch {
    return void 0;
  } finally {
    await handle.close().catch(() => void 0);
  }
}
async function scanMetadata(root, ignore) {
  const tokens = /* @__PURE__ */ new Map();
  const pending = [{ dir: root, rel: "" }];
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
        pending.push({ dir: join(dir, entry.name), rel: relPath });
        continue;
      }
      if (ignore.isIgnored(relPath, false)) continue;
      fileTasks.push({ dir, entry: entry.name, relPath });
    }
    for (let offset = 0; offset < fileTasks.length; offset += FILE_CONCURRENCY) {
      const batch = fileTasks.slice(offset, offset + FILE_CONCURRENCY);
      const infos = await Promise.all(batch.map((task) => stat(join(task.dir, task.entry)).catch(() => void 0)));
      for (let index = 0; index < batch.length; index += 1) {
        const task = batch[index];
        const info = infos[index];
        if (task !== void 0 && info?.isFile()) {
          tokens.set(task.relPath, { size: info.size, mtimeNs: mtimeNs(info) });
        }
      }
    }
  }
  return tokens;
}
function sameMetadata(left, right) {
  if (left.size !== right.size) return false;
  for (const [path, token] of left) {
    const other = right.get(path);
    if (other === void 0 || other.size !== token.size || other.mtimeNs !== token.mtimeNs) return false;
  }
  return true;
}
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
async function gitChangedPaths(root) {
  if (!await hasGitRoot(root)) return void 0;
  let stdout;
  try {
    const result = await execFileAsync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], {
      cwd: root,
      encoding: "utf8",
      timeout: 1e4
    });
    stdout = result.stdout;
  } catch {
    return void 0;
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
async function hasGitRoot(root) {
  let dir = root;
  for (let depth = 0; depth < 12; depth += 1) {
    try {
      const probe = await stat(join(dir, ".git"));
      if (probe.isDirectory() || probe.isFile()) return true;
    } catch {
    }
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
  return false;
}
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
  if (before !== void 0) {
    for (const [path] of before.files) {
      if (files.has(path)) continue;
      const meta = await metaOf(join(root, path), path, options);
      if (meta === void 0) continue;
      files.set(path, meta);
    }
  }
  return { root, time: Date.now(), files };
}
function execFileAsync(file, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, [...args], { cwd: options.cwd, stdio: ["ignore", "pipe", "ignore"] });
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
        reject(new Error(`git ${file} timed out`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`git ${file} exited ${String(code)}`));
        return;
      }
      const stdout = Buffer.concat(chunks);
      resolve({ stdout: options.encoding === "utf8" ? stdout.toString("utf8") : stdout });
    });
  });
}

// packages/session/change-monitor/src/storage.ts
import { mkdir, readFile, readdir as readdir2, rename, unlink, writeFile } from "node:fs/promises";
import { join as join2 } from "node:path";
var RENAME_ATTEMPTS = 3;
var RENAME_RETRY_DELAY_MS = 25;
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
    return join2(this.root, `${sessionId}.jsonl`);
  }
  /**
   * Append one completed turn's record, trimming the file to `maxHistory`
   * turns. Never rejects the caller's turn: failures are reported by the
   * caller's best-effort wrapper.
   * @param record - the stored change set to persist.
   */
  async append(record) {
    const path = this.pathOf(record.sessionId);
    const previous = this.tails.get(record.sessionId) ?? Promise.resolve();
    const operation = previous.then(async () => {
      await mkdir(this.root, { recursive: true });
      const existing = await this.loadRaw(record.sessionId);
      existing.push(record);
      const kept = existing.slice(-this.maxHistory);
      const content = kept.map((item) => JSON.stringify(item)).join("\n") + "\n";
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
    const [main, temporary] = await Promise.all([
      readFile(path, "utf8").catch(() => void 0),
      readFile(`${path}.tmp`, "utf8").catch(() => void 0)
    ]);
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
    const turns = await this.loadTurns(sessionId);
    return turns.at(-1);
  }
  /** Sessions that have at least one retained record. */
  async listSessions() {
    try {
      const names = await readdir2(this.root);
      return names.filter((name) => name.endsWith(".jsonl")).map((name) => name.slice(0, -".jsonl".length));
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
function parseRecords(content) {
  if (content === void 0 || content === "") return [];
  const records = [];
  for (const line of content.split("\n")) {
    if (line === "") continue;
    try {
      records.push(JSON.parse(line));
    } catch {
    }
  }
  return records;
}
async function commitFile(temporary, target) {
  for (let attempt = 0; attempt < RENAME_ATTEMPTS; attempt += 1) {
    try {
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
}
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
function mergeSessionChangeSets(turns) {
  if (turns.length === 0) return null;
  const states = /* @__PURE__ */ new Map();
  for (const turn of turns) {
    for (const file of turn.files) {
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
      contextLines: DEFAULT_CONTEXT_LINES,
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
function storedFileOf(record, path) {
  return record.files.find((file) => file.path === path);
}

// packages/session/change-monitor/src/index.ts
var DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
var DEFAULT_SETTLE_DELAY_MS = 200;
var DEFAULT_SETTLE_MAX_ATTEMPTS = 5;
var DEFAULT_MAX_HISTORY = 100;
function resolvePositive(value, fallback, name) {
  if (value === void 0) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`change-monitor: ${name} must be a positive safe integer, got ${String(value)}`);
  }
  return value;
}
function resolveNonNegative(value, fallback, name) {
  if (value === void 0) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`change-monitor: ${name} must be a non-negative safe integer, got ${String(value)}`);
  }
  return value;
}
var _session_dec, _file_dec, _turn_dec, _debug_dec, _current_dec, _turns_dec, _a, _init;
var ChangeMonitorService = class extends (_a = TypertRemoteService, _turns_dec = [Remote("turns")], _current_dec = [Remote("current")], _debug_dec = [Remote("debug")], _turn_dec = [Remote("turn")], _file_dec = [Remote("file")], _session_dec = [Remote("session")], _a) {
  /**
   * @param ctx - host context carrying the session event feed.
   * @param config - plugin configuration (defaults apply).
   */
  constructor(ctx, config = {}) {
    super(ctx, "changeMonitor");
    __runInitializers(_init, 5, this);
    __publicField(this, "config");
    __publicField(this, "ignore");
    __publicField(this, "store");
    __publicField(this, "states", /* @__PURE__ */ new Map());
    /**
     * Latest completed turn's summary per live session (the wire `current`
     * value without retained content). One small entry per session, dropped on
     * disposal; the full record lives only on disk.
     */
    __publicField(this, "latest", /* @__PURE__ */ new Map());
    /** Diagnostic ring: recent turn events, for runtime verification. */
    __publicField(this, "eventLog", []);
    this.config = {
      enabled: config.enabled ?? true,
      exclude: config.exclude ?? [],
      include: config.include ?? [],
      maxSnapshotFileSize: resolvePositive(config.maxSnapshotFileSize, DEFAULT_MAX_FILE_SIZE, "maxSnapshotFileSize"),
      maxDiffFileSize: resolvePositive(config.maxDiffFileSize, DEFAULT_MAX_FILE_SIZE, "maxDiffFileSize"),
      maxDiffCells: resolvePositive(config.maxDiffCells, DEFAULT_MAX_DIFF_CELLS, "maxDiffCells"),
      contextLines: resolveNonNegative(config.contextLines, DEFAULT_CONTEXT_LINES, "contextLines"),
      settleDelayMs: resolveNonNegative(config.settleDelayMs, DEFAULT_SETTLE_DELAY_MS, "settleDelayMs"),
      settleMaxAttempts: resolvePositive(config.settleMaxAttempts, DEFAULT_SETTLE_MAX_ATTEMPTS, "settleMaxAttempts"),
      historyEnabled: config.historyEnabled ?? true,
      maxHistory: resolvePositive(config.maxHistory, DEFAULT_MAX_HISTORY, "maxHistory"),
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
        this.eventLog.push({ time: Date.now(), session: session.id, type: event.type, turn: event.data.turn ?? 0 });
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
    void operation().catch((error) => {
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
      bookkeeping.before = candidates === void 0 ? await snapshotWorkspace(cwd, {
        maxSnapshotFileSize: this.config.maxSnapshotFileSize,
        ignore: this.ignore
      }) : await snapshotCandidates(cwd, candidates, {
        maxSnapshotFileSize: this.config.maxSnapshotFileSize,
        ignore: this.ignore
      });
    })().then(
      () => void 0,
      (error) => {
        this.ctx.logger.warn(`change monitor turn ${turn} before snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    );
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
      this.eventLog.push({ time: Date.now(), session: sessionId, type: "debug/disabled", turn: bookkeeping.turn });
      return;
    }
    await bookkeeping.beforeReady;
    const before = bookkeeping.before;
    if (before === void 0) {
      this.eventLog.push({ time: Date.now(), session: sessionId, type: "debug/no-before", turn: bookkeeping.turn });
      this.ctx.logger.warn(`change monitor: turn ${bookkeeping.turn} has no before snapshot; skipping`);
      return;
    }
    let after;
    if (bookkeeping.git) {
      const candidates = await gitChangedPaths(root) ?? [];
      await this.waitForStability(root, candidates);
      after = await snapshotCandidates(root, candidates, {
        maxSnapshotFileSize: this.config.maxSnapshotFileSize,
        ignore: this.ignore,
        retainContent: false
      }, before);
      const beforeMerged = await this.backfillHeadBefore(root, before, after);
      const record2 = await this.buildChangeSet(sessionId, bookkeeping.turn, beforeMerged, after);
      this.latest.set(sessionId, summarizeChangeSet(record2));
      this.eventLog.push({ time: Date.now(), session: sessionId, type: "debug/stored", turn: bookkeeping.turn });
      if (this.config.historyEnabled) {
        await this.store.append(record2);
      }
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
    this.eventLog.push({ time: Date.now(), session: sessionId, type: "debug/stored", turn: bookkeeping.turn });
    if (this.config.historyEnabled) {
      await this.store.append(record);
    }
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
   * snapshot: a file clean at turn start that the turn modified. Its
   * turn-start content is exactly the git HEAD version, so `git show` supplies
   * it; untracked new files (absent from HEAD too) stay before-less and the
   * diff reports them as added.
   * @param root - workspace root.
   * @param before - the turn-start snapshot (read-only).
   * @param after - the turn-end candidate snapshot.
   * @returns the before snapshot with the backfilled entries.
   */
  async backfillHeadBefore(root, before, after) {
    const missing = [...after.files.keys()].filter((path) => !before.files.has(path));
    if (missing.length === 0) return before;
    const merged = new Map(before.files);
    for (const path of missing) {
      const text = await readHeadFile(root, path);
      if (text === null) continue;
      merged.set(path, {
        size: Buffer.byteLength(text, "utf8"),
        mtimeNs: 0,
        hash: createHash2("sha256").update(text).digest("hex"),
        kind: "text",
        content: text
      });
    }
    return { ...before, files: merged };
  }
  /** Compute the stored change set from the before/after snapshots. */
  async buildChangeSet(sessionId, turn, before, after) {
    const allPaths = /* @__PURE__ */ new Set([...before.files.keys(), ...after.files.keys()]);
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
    const afterText = afterMeta !== void 0 && (beforeMeta === void 0 || beforeMeta.hash === null || beforeMeta.hash !== afterMeta.hash) ? await readTextFile(join3(root, path), this.config.maxDiffFileSize) : void 0;
    if (beforeMeta !== void 0 && afterMeta !== void 0) {
      if (beforeMeta.hash !== null && afterMeta.hash !== null && beforeMeta.hash === afterMeta.hash) {
        return void 0;
      }
      if (beforeMeta.hash === null && afterMeta.hash === null && beforeMeta.size === afterMeta.size) {
        return void 0;
      }
      const beforeText2 = beforeMeta.content;
      if (beforeText2 !== void 0 && afterText !== null && afterText !== void 0) {
        if (beforeText2 === afterText) return void 0;
        const diff = diffText(beforeText2, afterText, {
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
          beforeContent: beforeText2,
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
  async turns(request) {
    return await this.guard(async () => {
      const records = await this.store.loadTurns(request.sessionId);
      return { ok: true, value: records.map(summarizeTurn).reverse() };
    });
  }
  async current(request) {
    return await this.guard(async () => {
      const cached = this.latest.get(request.sessionId);
      if (cached !== void 0) return { ok: true, value: cached };
      const record = await this.store.latest(request.sessionId);
      return { ok: true, value: record === void 0 ? null : summarizeChangeSet(record) };
    });
  }
  async debug() {
    return { ok: true, value: [...this.eventLog] };
  }
  async turn(request) {
    return await this.guard(async () => {
      const record = await this.findTurn(request.sessionId, request.turn);
      return { ok: true, value: record === void 0 ? null : summarizeChangeSet(record) };
    });
  }
  async file(request) {
    return await this.guard(async () => {
      const record = await this.findTurn(request.sessionId, request.turn);
      if (record === void 0) {
        return { ok: false, error: { code: "not-found", message: `turn ${request.turn} has no record` } };
      }
      const stored = storedFileOf(record, request.path);
      if (stored === void 0) {
        return { ok: false, error: { code: "not-found", message: `file ${JSON.stringify(request.path)} is not in turn ${request.turn}` } };
      }
      return { ok: true, value: withoutContent(stored) };
    });
  }
  async session(request) {
    return await this.guard(async () => {
      const records = await this.store.loadTurns(request.sessionId);
      const merged = mergeSessionChangeSets(records);
      return { ok: true, value: merged };
    });
  }
  /** Find one stored turn record. */
  async findTurn(sessionId, turn) {
    const records = await this.store.loadTurns(sessionId);
    return records.find((record) => record.turn === turn);
  }
  /** Contain a Remote operation: failures become structured `internal` errors. */
  async guard(operation) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: { code: "internal", message } };
    }
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "turns", _turns_dec, ChangeMonitorService);
__decorateElement(_init, 1, "current", _current_dec, ChangeMonitorService);
__decorateElement(_init, 1, "debug", _debug_dec, ChangeMonitorService);
__decorateElement(_init, 1, "turn", _turn_dec, ChangeMonitorService);
__decorateElement(_init, 1, "file", _file_dec, ChangeMonitorService);
__decorateElement(_init, 1, "session", _session_dec, ChangeMonitorService);
__decoratorMetadata(_init, ChangeMonitorService);
__publicField(ChangeMonitorService, "Config", z.object({
  enabled: z.boolean().default(true),
  exclude: z.array(z.string()).default([]),
  include: z.array(z.string()).default([]),
  maxSnapshotFileSize: z.number().step(1).min(1).default(DEFAULT_MAX_FILE_SIZE),
  maxDiffFileSize: z.number().step(1).min(1).default(DEFAULT_MAX_FILE_SIZE),
  maxDiffCells: z.number().step(1).min(1).default(DEFAULT_MAX_DIFF_CELLS),
  contextLines: z.number().step(1).min(0).default(DEFAULT_CONTEXT_LINES),
  settleDelayMs: z.number().step(1).min(0).default(DEFAULT_SETTLE_DELAY_MS),
  settleMaxAttempts: z.number().step(1).min(1).default(DEFAULT_SETTLE_MAX_ATTEMPTS),
  historyEnabled: z.boolean().default(true),
  maxHistory: z.number().step(1).min(1).default(DEFAULT_MAX_HISTORY),
  storeRoot: z.string()
}));
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
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
async function candidateTokens(root, candidates) {
  const tokens = /* @__PURE__ */ new Map();
  const CONCURRENCY = 32;
  for (let offset = 0; offset < candidates.length; offset += CONCURRENCY) {
    const batch = candidates.slice(offset, offset + CONCURRENCY);
    const infos = await Promise.all(batch.map((path) => stat2(join3(root, path)).catch(() => void 0)));
    for (let index = 0; index < batch.length; index += 1) {
      const path = batch[index];
      const info = infos[index];
      if (path !== void 0 && info?.isFile()) {
        tokens.set(path, { size: info.size, mtimeNs: mtimeNs2(info) });
      }
    }
  }
  return tokens;
}
function sameTokens(left, right) {
  if (left.size !== right.size) return false;
  for (const [path, token] of left) {
    const other = right.get(path);
    if (other === void 0 || other.size !== token.size || other.mtimeNs !== token.mtimeNs) return false;
  }
  return true;
}
function mtimeNs2(info) {
  if (info.mtimeNs !== void 0) return info.mtimeNs;
  return Math.floor(info.mtimeMs * 1e6);
}
async function readHeadFile(root, path) {
  try {
    const { stdout } = await execFileAsync("git", ["show", `HEAD:${path}`], { cwd: root, encoding: "buffer", timeout: 1e4 });
    if (stdout.subarray(0, 8192).includes(0)) return null;
    return stdout.toString("utf8");
  } catch {
    return null;
  }
}
var index_default = ChangeMonitorService;
export {
  ChangeMonitorService,
  ChangeSetStore,
  DEFAULT_IGNORE_PATTERNS,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_HISTORY,
  DEFAULT_SETTLE_DELAY_MS,
  DEFAULT_SETTLE_MAX_ATTEMPTS,
  compileIgnorePatterns,
  index_default as default,
  diffText,
  mergeSessionChangeSets,
  readTextFile,
  sameMetadata,
  scanMetadata,
  snapshotWorkspace,
  summarizeChangeSet,
  summarizeTurn
};
