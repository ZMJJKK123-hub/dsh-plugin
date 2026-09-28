/**
 * One git command execution: argv-direct spawn through the `ctx.subprocess`
 * seam, optional confinement through `ctx.sandbox`, a caller-owned deadline,
 * and bounded collection of both output streams. The composition mirrors the
 * sandboxed bash executor: confine → spawn → classify denial — except here
 * the argv never passes through a shell, so tool arguments need no quoting.
 *
 * @module @dsh-custom/dsh-git-local
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SandboxPolicy, SandboxProvider } from '@deepseek-ai/dsh-sandbox';
/** A fully-specified one-shot git run. */
export interface GitRunInput {
    /** git arguments WITHOUT the executable; never shell-interpreted. */
    readonly argv: readonly string[];
    /** Working directory for the child. */
    readonly cwd: string;
    /** Deadline in milliseconds; firing terminates the child and marks the result timed out. */
    readonly timeoutMs: number;
    /** Per-stream in-memory collection cap in bytes; overflow keeps the tail. */
    readonly maxOutputBytes: number;
    /** Grace period handed to the subprocess termination procedure. */
    readonly graceMs: number;
    /** Caller cancellation; firing marks the result aborted. */
    readonly signal?: AbortSignal | undefined;
    /** Explicit environment entries merged onto the provider's scrubbed base. */
    readonly env?: Readonly<Record<string, string>> | undefined;
    /** Confinement to apply; absent means the host mounted no sandbox policy for this call. */
    readonly sandbox?: {
        readonly provider: SandboxProvider;
        readonly policy: SandboxPolicy;
    } | undefined;
}
/** Outcome of one git run, in the shell seam's resolve-not-reject vocabulary. */
export interface GitRunResult {
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly truncated: boolean;
    readonly denied: boolean;
    readonly timedOut: boolean;
    readonly aborted: boolean;
}
/**
 * Run one git command through `ctx.subprocess`, confined when a sandbox policy
 * is supplied. Resolves with the outcome for ANY process exit — nonzero exits,
 * timeouts, aborts, and denials included — and rejects only when the process
 * could not spawn at all.
 * @param ctx - context carrying `ctx.subprocess`.
 * @param gitPath - resolved git executable path (argv[0]).
 * @param input - the fully-specified run.
 */
export declare function runGitCommand(ctx: Context, gitPath: string, input: GitRunInput): Promise<GitRunResult>;
//# sourceMappingURL=run.d.ts.map