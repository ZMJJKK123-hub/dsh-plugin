import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import z from "@deepseek-ai/schemastery";
import { GitError, GitService } from "@dsh-custom/dsh-git";
//#region lib/types/parse.js
/**
* Pure parsers for the NUL-delimited git formats the local provider runs:
* `status --porcelain=v1 -z --branch`, `log --format` with unit/field
* separators, and `for-each-ref` with NUL separators. No I/O — every function
* is a pure projection of one command's output, so tests cover the formats
* without spawning git.
*
* @module @dsh-custom/dsh-git-local
*/
const EMPTY_HEADER = {
	branch: void 0,
	upstream: void 0,
	ahead: 0,
	behind: 0,
	initial: false,
	detached: false
};
/**
* Parse `git status --porcelain=v1 -z --branch` output. The first record is
* the `## ` header when `--branch` produced one; each entry record is `XY <path>`,
* and rename/copy entries carry their origin path as the next record.
* @param output - raw stdout of the status command.
*/
function parseStatusZ(output) {
	const records = output.split("\0");
	const header = records[0] === void 0 ? EMPTY_HEADER : parseBranchHeader(records[0]);
	const entries = [];
	const body = header === EMPTY_HEADER ? records : records.slice(1);
	for (let index = 0; index < body.length; index += 1) {
		const record = body[index];
		if (record === void 0 || record === "") continue;
		const code = record.slice(0, 2);
		const path = record.slice(3);
		const renameOrigin = code[0] === "R" || code[0] === "C";
		const originPath = renameOrigin ? body[index + 1] : void 0;
		if (renameOrigin) index += 1;
		const untracked = code === "??";
		entries.push({
			code,
			path,
			originPath: originPath ?? void 0,
			staged: !untracked && code[0] !== void 0 && code[0] !== " ",
			unstaged: code[1] !== void 0 && code[1] !== " ",
			untracked
		});
	}
	return {
		...header,
		entries
	};
}
/** Parse the `## ` branch header record of `status --porcelain=v1 -z --branch`. */
function parseBranchHeader(record) {
	if (!record.startsWith("## ")) return EMPTY_HEADER;
	const body = record.slice(3);
	if (body === "HEAD (no branch)") return {
		...EMPTY_HEADER,
		detached: true
	};
	if (body.startsWith("No commits yet on ")) return {
		...EMPTY_HEADER,
		initial: true,
		branch: body.slice(18)
	};
	const dotIndex = body.indexOf("...");
	if (dotIndex === -1) return {
		...EMPTY_HEADER,
		branch: body
	};
	const branch = body.slice(0, dotIndex);
	let rest = body.slice(dotIndex + 3);
	let upstream;
	let ahead = 0;
	let behind = 0;
	const bracketIndex = rest.indexOf(" [");
	if (bracketIndex === -1) upstream = rest === "" ? void 0 : rest;
	else {
		upstream = rest.slice(0, bracketIndex);
		rest = rest.slice(bracketIndex + 2, rest.length - 1);
		if (rest !== "gone") for (const part of rest.split(", ")) {
			const aheadMatch = /^ahead (\d+)$/.exec(part);
			if (aheadMatch !== null) ahead = Number(aheadMatch[1]);
			const behindMatch = /^behind (\d+)$/.exec(part);
			if (behindMatch !== null) behind = Number(behindMatch[1]);
		}
	}
	return {
		branch,
		upstream,
		ahead,
		behind,
		initial: false,
		detached: false
	};
}
/** Field separator of the `log` format string (`%x1f`). */
const FIELD = "";
/** Unit separator of the `log` format string (`%x1e`). */
const UNIT = "";
/**
* Parse `git log --format='%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1e'` output.
* @param output - raw stdout of the log command.
*/
function parseLog(output) {
	const entries = [];
	for (const unit of output.split(UNIT)) {
		if (unit === "" || unit === "\n") continue;
		const [hash, shortHash, author, date, subject] = unit.replace(/^\n/, "").split(FIELD);
		if (hash === void 0 || shortHash === void 0 || author === void 0 || date === void 0 || subject === void 0) continue;
		entries.push({
			hash,
			shortHash,
			author,
			date,
			subject
		});
	}
	return entries;
}
/**
* Parse `git for-each-ref --format='%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(objectname:short)' refs/heads` output.
* @param output - raw stdout of the for-each-ref command.
*/
function parseBranches(output) {
	const branches = [];
	for (const line of output.split("\n")) {
		if (line === "") continue;
		const [name, headMark, upstream, shortHash] = line.split("\0");
		if (name === void 0 || headMark === void 0 || upstream === void 0 || shortHash === void 0) continue;
		branches.push({
			name,
			current: headMark === "*",
			upstream: upstream === "" ? void 0 : upstream,
			shortHash
		});
	}
	return branches;
}
//#endregion
//#region lib/types/run.js
/**
* One git command execution: argv-direct spawn through the `ctx.subprocess`
* seam, optional confinement through `ctx.sandbox`, a caller-owned deadline,
* and bounded collection of both output streams. The composition mirrors the
* sandboxed bash executor: confine → spawn → classify denial — except here
* the argv never passes through a shell, so tool arguments need no quoting.
*
* @module @dsh-custom/dsh-git-local
*/
/**
* Run one git command through `ctx.subprocess`, confined when a sandbox policy
* is supplied. Resolves with the outcome for ANY process exit — nonzero exits,
* timeouts, aborts, and denials included — and rejects only when the process
* could not spawn at all.
* @param ctx - context carrying `ctx.subprocess`.
* @param gitPath - resolved git executable path (argv[0]).
* @param input - the fully-specified run.
*/
async function runGitCommand(ctx, gitPath, input) {
	let argv = [gitPath, ...input.argv];
	let denialSignatures = [];
	if (input.sandbox !== void 0) {
		const confined = input.sandbox.provider.confine([...argv], input.sandbox.policy);
		argv = confined.argv;
		denialSignatures = confined.denialSignatures;
	}
	const controller = new AbortController();
	let timedOut = false;
	let aborted = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, input.timeoutMs);
	const onCallerAbort = () => {
		aborted = true;
		controller.abort();
	};
	input.signal?.addEventListener("abort", onCallerAbort, { once: true });
	if (input.signal?.aborted === true) onCallerAbort();
	try {
		const handle = ctx.subprocess.spawn({
			argv,
			cwd: input.cwd,
			stdio: {
				stdin: "ignore",
				stdout: { maxBytes: input.maxOutputBytes },
				stderr: { maxBytes: input.maxOutputBytes }
			},
			graceMs: input.graceMs,
			signal: controller.signal,
			...input.env === void 0 ? {} : { env: input.env }
		});
		const outcome = await handle.done;
		const stdoutRead = handle.collected.stdout?.readFrom(0);
		const stderrRead = handle.collected.stderr?.readFrom(0);
		const stdout = stdoutRead?.text ?? "";
		const stderr = stderrRead?.text ?? "";
		const denied = (outcome.exitCode ?? 1) !== 0 && denialSignatures.some((signature) => stderr.toLowerCase().includes(signature.toLowerCase()));
		return {
			exitCode: outcome.exitCode,
			stdout,
			stderr,
			truncated: stdoutRead?.lossy === true || stderrRead?.lossy === true,
			denied,
			timedOut,
			aborted
		};
	} finally {
		clearTimeout(timer);
		input.signal?.removeEventListener("abort", onCallerAbort);
	}
}
//#endregion
//#region lib/types/index.js
/**
* Local Service Provider for the git capability seam over the subprocess
* seam: repository facts (root/status/diff/log/branches) and index/commit/push
* mutations from the git executable on this host's PATH. Every command runs
* argv-direct through `ctx.subprocess` — never through a shell — and is
* confined by `ctx.sandbox` under the standing policy resolved from
* `ctx.sandboxPolicy` (falling back to unconfined only when the host mounted
* no sandbox or the standing mode is full access). Mutations run at the
* repository root with the repository as the writable root, so a read-only
* standing policy denies them honestly.
*
* @module @dsh-custom/dsh-git-local
*/
const BRANCHES_FORMAT = "%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(objectname:short)";
const LOG_FORMAT = "%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1e";
/** Ref namespace every checkpoint lives under; HEAD, branches, and the user's index stay untouched. */
const CHECKPOINT_REF_PREFIX = "refs/dsh/checkpoints";
/** Fixed synthetic identity for shadow commits: they are host artifacts, not user commits. */
const CHECKPOINT_AUTHOR = "dsh-checkpoint";
const CHECKPOINT_EMAIL = "dsh-checkpoint@local";
/** Sanitize a series key into a refname-safe segment. */
function checkpointSeries(series) {
	return series.replace(/[^A-Za-z0-9._-]+/g, "-");
}
/** The ref one checkpoint lives at; the zero-padded ordinal keeps refname order numeric. */
function checkpointRef(series, index) {
	return `${CHECKPOINT_REF_PREFIX}/${series}/${String(index).padStart(6, "0")}`;
}
/**
* Throw the honest failure for one finished-but-unsuccessful run.
* @param what - the git subcommand name, for the message.
* @param result - the run outcome.
*/
function failRun(what, result) {
	if (result.denied) throw new GitError(`git ${what} was blocked by the sandbox policy`, result.exitCode, result.stderr, true);
	if (result.timedOut) throw new GitError(`git ${what} timed out`, result.exitCode, result.stderr);
	throw new GitError(`git ${what} failed: ${result.stderr.trim() !== "" ? result.stderr.trim() : `exit code ${result.exitCode ?? "null"}`}`, result.exitCode, result.stderr);
}
var LocalGitService = class LocalGitService extends GitService {
	static inject = ["subprocess"];
	static Config = z.object({
		gitBinary: z.string().default("git"),
		timeoutMs: z.number().default(3e4),
		maxDiffBytes: z.number().default(262144),
		maxLogCount: z.number().default(100),
		maxOutputBytes: z.number().default(65536),
		graceMs: z.number().default(2500),
		confine: z.boolean().default(true),
		checkpointKeepLast: z.number().default(50)
	});
	resolvedConfig;
	gitPathCache;
	constructor(ctx, config) {
		super(ctx);
		this.resolvedConfig = config;
	}
	/**
	* Resolve the git executable once per service lifetime.
	* @param signal - aborts the lookup.
	*/
	async executable(signal) {
		this.gitPathCache ??= await this.ctx.subprocess.resolveExecutable(this.resolvedConfig.gitBinary, void 0, signal);
		return this.gitPathCache;
	}
	/**
	* Confinement for one call: the standing policy's mode with the call's own
	* repository as the writable root, skipped when disabled, unmounted, or the
	* standing mode is full access.
	* @param cwd - the repository directory this call reads or writes.
	*/
	confinement(cwd) {
		if (!this.resolvedConfig.confine) return void 0;
		const provider = this.ctx.get("sandbox");
		const policyService = this.ctx.get("sandboxPolicy");
		if (provider === void 0 || policyService === void 0) return void 0;
		const standing = policyService.resolve();
		if (standing.mode === "danger-full-access") return void 0;
		return {
			provider,
			policy: {
				mode: standing.mode,
				workspaceRoot: cwd,
				...standing.sessionId !== void 0 ? { sessionId: standing.sessionId } : {}
			}
		};
	}
	/**
	* Run one read-only git command with opportunistic locking disabled, so
	* read commands take no index locks and survive read-only confinement.
	*/
	async read(cwd, argv, maxOutputBytes, signal) {
		const gitPath = await this.executable(signal);
		return runGitCommand(this.ctx, gitPath, {
			argv: [
				"-c",
				"core.quotepath=false",
				...argv
			],
			cwd,
			timeoutMs: this.resolvedConfig.timeoutMs,
			maxOutputBytes,
			graceMs: this.resolvedConfig.graceMs,
			signal,
			env: { GIT_OPTIONAL_LOCKS: "0" },
			sandbox: this.confinement(cwd)
		});
	}
	async resolveRoot(cwd, signal) {
		const result = await this.read(cwd, ["rev-parse", "--show-toplevel"], this.resolvedConfig.maxOutputBytes, signal);
		if (result.exitCode !== 0 || result.timedOut || result.aborted) return void 0;
		const root = result.stdout.trim();
		return root === "" ? void 0 : root;
	}
	async status(cwd, signal) {
		const root = await this.resolveRoot(cwd, signal);
		if (root === void 0) throw new GitError(`not a git repository: ${cwd}`, 128, "");
		const result = await this.read(root, [
			"status",
			"--porcelain=v1",
			"-z",
			"--branch"
		], this.resolvedConfig.maxOutputBytes, signal);
		if (result.exitCode !== 0 || result.timedOut || result.aborted) failRun("status", result);
		return {
			...parseStatusZ(result.stdout),
			root
		};
	}
	async diff(cwd, options, signal) {
		const staged = options?.staged === true;
		const path = options?.path === "" ? void 0 : options?.path;
		const maxBytes = options?.maxBytes ?? this.resolvedConfig.maxDiffBytes;
		const result = await this.read(cwd, [
			"diff",
			"--no-color",
			...staged ? ["--cached"] : [],
			...path !== void 0 ? ["--", path] : []
		], Math.max(maxBytes, 4096), signal);
		if (result.exitCode !== 0 || result.timedOut || result.aborted) failRun("diff", result);
		return {
			staged,
			path,
			patch: result.stdout,
			truncated: result.truncated
		};
	}
	async log(cwd, options, signal) {
		const maxCount = Math.min(options?.maxCount ?? this.resolvedConfig.maxLogCount, this.resolvedConfig.maxLogCount);
		const ref = options?.ref === "" ? void 0 : options?.ref;
		const path = options?.path === "" ? void 0 : options?.path;
		const result = await this.read(cwd, [
			"log",
			"--no-color",
			"--max-count",
			String(maxCount),
			`--format=${LOG_FORMAT}`,
			...ref !== void 0 ? [ref] : [],
			...path !== void 0 ? ["--", path] : []
		], this.resolvedConfig.maxOutputBytes, signal);
		if (result.exitCode !== 0 && result.stderr.includes("does not have any commits yet")) return { entries: [] };
		if (result.exitCode !== 0 || result.timedOut || result.aborted) failRun("log", result);
		return { entries: parseLog(result.stdout) };
	}
	async branches(cwd, signal) {
		const result = await this.read(cwd, [
			"for-each-ref",
			`--format=${BRANCHES_FORMAT}`,
			"refs/heads"
		], this.resolvedConfig.maxOutputBytes, signal);
		if (result.exitCode !== 0 || result.timedOut || result.aborted) failRun("for-each-ref", result);
		return { branches: parseBranches(result.stdout) };
	}
	/**
	* Run one repository-mutating git command at the repository root: the same
	* standing-policy confinement as reads, with the repository itself as the
	* writable root, so a read-only policy denies the mutation honestly while
	* a workspace-write policy confines writes to the repository.
	*/
	async write(cwd, argv, signal) {
		await this.runEnv(cwd, argv, {}, signal);
	}
	/**
	* Run one confined git command with explicit environment entries (the
	* checkpoint plumbing's temp index and synthetic identity) and return its
	* output; a nonzero exit is the same honest failure as {@link write}.
	*/
	async runEnv(cwd, argv, env, signal) {
		const gitPath = await this.executable(signal);
		const result = await runGitCommand(this.ctx, gitPath, {
			argv: [
				"-c",
				"core.quotepath=false",
				...argv
			],
			cwd,
			timeoutMs: this.resolvedConfig.timeoutMs,
			maxOutputBytes: this.resolvedConfig.maxOutputBytes,
			graceMs: this.resolvedConfig.graceMs,
			signal,
			env,
			sandbox: this.confinement(cwd)
		});
		if (result.exitCode !== 0 || result.timedOut || result.aborted) failRun(argv[0] ?? "git", result);
		return result;
	}
	/** The cumulative staged path list after a staging mutation. */
	async stagedPaths(cwd, signal) {
		const result = await this.read(cwd, [
			"diff",
			"--cached",
			"--name-only",
			"-z"
		], this.resolvedConfig.maxOutputBytes, signal);
		if (result.exitCode !== 0 || result.timedOut || result.aborted) failRun("diff", result);
		return result.stdout.split("\0").filter((path) => path !== "");
	}
	/** Build the argv of one stage/unstage pass: explicit paths, or the whole work tree. */
	static stageArgv(verb, options) {
		const all = options?.all === true;
		const paths = options?.paths?.filter((path) => path.trim() !== "") ?? [];
		if (!all && paths.length === 0) throw new GitError(`git ${verb} requires non-empty paths or all: true`, null, "");
		if (verb === "add") return all ? ["add", "--all"] : [
			"add",
			"--",
			...paths
		];
		return all ? ["reset", "--quiet"] : [
			"restore",
			"--staged",
			"--",
			...paths
		];
	}
	async stage(cwd, options, signal) {
		await this.write(cwd, LocalGitService.stageArgv("add", options), signal);
		return { stagedPaths: await this.stagedPaths(cwd, signal) };
	}
	async unstage(cwd, options, signal) {
		await this.write(cwd, LocalGitService.stageArgv("unstage", options), signal);
		return { stagedPaths: await this.stagedPaths(cwd, signal) };
	}
	async commit(cwd, options, signal) {
		const message = options.message.trim();
		if (message === "") throw new GitError("git commit requires a non-empty message", null, "");
		await this.write(cwd, [
			"commit",
			"-m",
			message
		], signal);
		const result = await this.read(cwd, [
			"log",
			"--max-count",
			"1",
			`--format=${LOG_FORMAT}`
		], this.resolvedConfig.maxOutputBytes, signal);
		if (result.exitCode !== 0 || result.timedOut || result.aborted) failRun("log", result);
		const entry = parseLog(result.stdout)[0];
		if (entry === void 0) throw new GitError("git commit succeeded but the new commit is not readable", null, "");
		return {
			hash: entry.hash,
			shortHash: entry.shortHash,
			subject: entry.subject
		};
	}
	async push(cwd, options, signal) {
		const setUpstream = options?.setUpstream === true;
		const remote = options?.remote === "" ? void 0 : options?.remote;
		const branch = options?.branch === "" ? void 0 : options?.branch;
		const summary = await this.status(cwd, signal);
		const argv = ["push", ...setUpstream ? ["--set-upstream"] : []];
		if (remote !== void 0) {
			const effectiveBranch = branch ?? summary.branch;
			if (effectiveBranch === void 0) throw new GitError("git push with an explicit remote needs a branch name on a detached HEAD", null, "");
			argv.push(remote, effectiveBranch);
		}
		await this.write(cwd, argv, signal);
		return {
			remote: remote ?? (summary.upstream !== void 0 ? summary.upstream.split("/")[0] ?? "origin" : "origin"),
			branch: branch ?? summary.branch ?? "HEAD",
			setUpstream
		};
	}
	/** Read one series' checkpoints, newest (highest ordinal) first. */
	async checkpointList(cwd, series, signal) {
		const root = await this.resolveRoot(cwd, signal);
		if (root === void 0) throw new GitError(`not a git repository: ${cwd}`, 128, "");
		const result = await this.read(root, [
			"for-each-ref",
			"--sort=-refname",
			`--format=%(refname)%00%(objectname)%00%(objectname:short)%00%(committerdate:iso8601-strict)%00%(contents:subject)`,
			`${CHECKPOINT_REF_PREFIX}/${series}`
		], this.resolvedConfig.maxOutputBytes, signal);
		if (result.exitCode !== 0 || result.timedOut || result.aborted) failRun("for-each-ref", result);
		const checkpoints = [];
		for (const line of result.stdout.split("\n")) {
			if (line === "") continue;
			const [ref, hash, shortHash, date, subject] = line.split("\0");
			const ordinal = ref?.split("/").at(-1);
			if (hash === void 0 || shortHash === void 0 || date === void 0 || ordinal === void 0) continue;
			checkpoints.push({
				series,
				index: Number(ordinal),
				hash,
				shortHash,
				label: subject ?? "",
				date
			});
		}
		return checkpoints;
	}
	/** Prune the series to the configured keep-last bound, oldest first. */
	async pruneCheckpoints(root, series, signal) {
		const listed = await this.checkpointList(root, series, signal);
		for (const checkpoint of listed.slice(this.resolvedConfig.checkpointKeepLast)) await this.runEnv(root, [
			"update-ref",
			"-d",
			checkpointRef(series, checkpoint.index)
		], {}, signal);
	}
	async checkpointCreate(cwd, options, signal) {
		const series = checkpointSeries(options.series);
		if (options.series.trim() === "" || !/^[A-Za-z0-9._-]+$/.test(series)) throw new GitError(`invalid checkpoint series "${options.series}"`, null, "");
		const label = options.label.trim() === "" ? `checkpoint ${options.index}` : options.label;
		const root = await this.resolveRoot(cwd, signal);
		if (root === void 0) throw new GitError(`not a git repository: ${cwd}`, 128, "");
		const scratch = await mkdtemp(join(tmpdir(), "dsh-git-cp-"));
		try {
			const env = {
				GIT_INDEX_FILE: join(scratch, "index"),
				GIT_AUTHOR_NAME: CHECKPOINT_AUTHOR,
				GIT_AUTHOR_EMAIL: CHECKPOINT_EMAIL,
				GIT_COMMITTER_NAME: CHECKPOINT_AUTHOR,
				GIT_COMMITTER_EMAIL: CHECKPOINT_EMAIL
			};
			await this.runEnv(root, ["add", "--all"], env, signal);
			const tree = (await this.runEnv(root, ["write-tree"], env, signal)).stdout.trim();
			if (tree === "") throw new GitError("git write-tree produced no tree", null, "");
			const hash = (await this.runEnv(root, [
				"commit-tree",
				tree,
				"-m",
				label
			], env, signal)).stdout.trim();
			if (hash === "") throw new GitError("git commit-tree produced no commit", null, "");
			await this.runEnv(root, [
				"update-ref",
				checkpointRef(series, options.index),
				hash
			], {}, signal);
			const date = (await this.runEnv(root, [
				"show",
				"-s",
				"--format=%cI",
				hash
			], {}, signal)).stdout.trim();
			await this.pruneCheckpoints(root, series, signal);
			return {
				series,
				index: options.index,
				hash,
				shortHash: hash.slice(0, 7),
				label,
				date
			};
		} finally {
			await rm(scratch, {
				recursive: true,
				force: true
			});
		}
	}
	async checkpoints(cwd, series, signal) {
		return { checkpoints: await this.checkpointList(cwd, checkpointSeries(series), signal) };
	}
	async checkpointRestore(cwd, options, signal) {
		const series = checkpointSeries(options.series);
		const root = await this.resolveRoot(cwd, signal);
		if (root === void 0) throw new GitError(`not a git repository: ${cwd}`, 128, "");
		const ref = checkpointRef(series, options.index);
		const resolved = await this.read(root, ["rev-parse", ref], this.resolvedConfig.maxOutputBytes, signal);
		if (resolved.exitCode !== 0 || resolved.timedOut || resolved.aborted) failRun("rev-parse", resolved);
		const hash = resolved.stdout.trim();
		if (hash === "") throw new GitError(`checkpoint ${series}/${options.index} not found`, 128, "");
		const paths = options.paths?.filter((path) => path.trim() !== "") ?? [];
		let restored = [];
		if (paths.length > 0) {
			const listed = await this.read(root, [
				"ls-tree",
				"-r",
				"--name-only",
				"-z",
				hash,
				"--",
				...paths
			], this.resolvedConfig.maxOutputBytes, signal);
			if (listed.exitCode !== 0 || listed.timedOut || listed.aborted) failRun("ls-tree", listed);
			restored = listed.stdout.split("\0").filter((path) => path !== "");
		}
		if (paths.length === 0) await this.write(root, [
			"restore",
			"--source",
			hash,
			"--worktree",
			"--",
			"."
		], signal);
		else if (restored.length > 0) await this.write(root, [
			"restore",
			"--source",
			hash,
			"--worktree",
			"--",
			...restored
		], signal);
		return {
			checkpoint: (await this.checkpointList(root, series, signal)).find((entry) => entry.index === options.index) ?? {
				series,
				index: options.index,
				hash,
				shortHash: hash.slice(0, 7),
				label: "",
				date: ""
			},
			restored
		};
	}
};
//#endregion
export { LocalGitService, LocalGitService as default };
