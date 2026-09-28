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
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { GitService } from '@dsh-custom/dsh-git';
import type { GitCheckpoint, GitCheckpointCreateOptions, GitCheckpointListResult, GitCheckpointRestoreOptions, GitCheckpointRestoreResult, GitCommitOptions, GitCommitResult, GitDiffOptions, GitLogOptions, GitPushOptions, GitPushResult, GitStageResult, GitStageSelection } from '@dsh-custom/dsh-git';
/** Plugin config (all optional — `static Config` supplies the defaults). */
export interface Config {
    /** Git executable: absolute path or bare PATH name. */
    gitBinary?: string;
    /** Per-command deadline in milliseconds. */
    timeoutMs?: number;
    /** Default cap of `diff` patch text in bytes. */
    maxDiffBytes?: number;
    /** Upper bound of commits one `log` call may return. */
    maxLogCount?: number;
    /** Per-stream in-memory collection cap for non-diff commands, in bytes. */
    maxOutputBytes?: number;
    /** Grace period handed to the subprocess termination procedure. */
    graceMs?: number;
    /** Confine commands under the standing sandbox policy; false runs everything unconfined. */
    confine?: boolean;
    /** Checkpoints kept per series; creating prunes beyond this bound. */
    checkpointKeepLast?: number;
}
type ResolvedConfig = Required<Config>;
export declare class LocalGitService extends GitService {
    static inject: string[];
    static Config: z<Config>;
    readonly resolvedConfig: ResolvedConfig;
    gitPathCache: string | undefined;
    constructor(ctx: Context, config: Config);
    /**
     * Resolve the git executable once per service lifetime.
     * @param signal - aborts the lookup.
     */
    private executable;
    /**
     * Confinement for one call: the standing policy's mode with the call's own
     * repository as the writable root, skipped when disabled, unmounted, or the
     * standing mode is full access.
     * @param cwd - the repository directory this call reads or writes.
     */
    private confinement;
    /**
     * Run one read-only git command with opportunistic locking disabled, so
     * read commands take no index locks and survive read-only confinement.
     */
    private read;
    resolveRoot(cwd: string, signal?: AbortSignal): Promise<string | undefined>;
    status(cwd: string, signal?: AbortSignal): Promise<{
        root: string;
        entries: readonly import("@dsh-custom/dsh-git").GitStatusEntry[];
        branch: string | undefined;
        upstream: string | undefined;
        ahead: number;
        behind: number;
        initial: boolean;
        detached: boolean;
    }>;
    diff(cwd: string, options?: GitDiffOptions, signal?: AbortSignal): Promise<{
        staged: boolean;
        path: string | undefined;
        patch: string;
        truncated: boolean;
    }>;
    log(cwd: string, options?: GitLogOptions, signal?: AbortSignal): Promise<{
        entries: readonly import("@dsh-custom/dsh-git").GitLogEntry[];
    }>;
    branches(cwd: string, signal?: AbortSignal): Promise<{
        branches: readonly import("@dsh-custom/dsh-git").GitBranch[];
    }>;
    /**
     * Run one repository-mutating git command at the repository root: the same
     * standing-policy confinement as reads, with the repository itself as the
     * writable root, so a read-only policy denies the mutation honestly while
     * a workspace-write policy confines writes to the repository.
     */
    private write;
    /**
     * Run one confined git command with explicit environment entries (the
     * checkpoint plumbing's temp index and synthetic identity) and return its
     * output; a nonzero exit is the same honest failure as {@link write}.
     */
    private runEnv;
    /** The cumulative staged path list after a staging mutation. */
    private stagedPaths;
    /** Build the argv of one stage/unstage pass: explicit paths, or the whole work tree. */
    private static stageArgv;
    stage(cwd: string, options?: GitStageSelection, signal?: AbortSignal): Promise<GitStageResult>;
    unstage(cwd: string, options?: GitStageSelection, signal?: AbortSignal): Promise<GitStageResult>;
    commit(cwd: string, options: GitCommitOptions, signal?: AbortSignal): Promise<GitCommitResult>;
    push(cwd: string, options?: GitPushOptions, signal?: AbortSignal): Promise<GitPushResult>;
    /** Read one series' checkpoints, newest (highest ordinal) first. */
    private checkpointList;
    /** Prune the series to the configured keep-last bound, oldest first. */
    private pruneCheckpoints;
    checkpointCreate(cwd: string, options: GitCheckpointCreateOptions, signal?: AbortSignal): Promise<GitCheckpoint>;
    checkpoints(cwd: string, series: string, signal?: AbortSignal): Promise<GitCheckpointListResult>;
    checkpointRestore(cwd: string, options: GitCheckpointRestoreOptions, signal?: AbortSignal): Promise<GitCheckpointRestoreResult>;
}
export default LocalGitService;
//# sourceMappingURL=index.d.ts.map