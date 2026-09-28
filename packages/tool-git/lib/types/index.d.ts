/**
 * Model-facing git tools over the `ctx.git` capability seam: `git_status`,
 * `git_diff`, `git_log`, `git_branch_list`, plus the index/commit/push tools
 * `git_stage`, `git_unstage`, `git_commit`, and `git_push`. The tools add no
 * execution of their own — they resolve the working directory from the
 * session (or an explicit `workdir` argument), call the seam, and render its
 * typed results, so any future git provider swap keeps the tool surface
 * unchanged.
 *
 * @module @dsh-custom/dsh-tool-git
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "tool-git";
/** Services required by the git tools. */
export declare const inject: string[];
/** Plugin config (all optional — `Config` supplies the defaults). */
export interface Config {
    /** Model-facing cap of one `git_diff` patch in bytes. */
    maxDiffBytes?: number;
    /** Model-facing cap of commits one `git_log` call returns. */
    maxLogCount?: number;
}
export declare const Config: z<Config>;
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map