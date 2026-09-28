/**
 * Lossless-JSON projections of the seam's results: mutable arrays and
 * omitted-when-absent optional fields, the shape every wire surface (Remote
 * results, tool canonical values) must carry — a JSON snapshot drops an
 * explicit `undefined`, so absent optionals are omitted rather than nulled.
 *
 * @module @dsh-custom/dsh-git
 */
import type { GitBranchListResult, GitDiffResult, GitLogResult, GitStageResult, GitStatusSummary } from './types.ts';
/** JSON view of {@link GitStatusSummary}. */
export interface GitStatusJson {
    readonly root: string;
    readonly ahead: number;
    readonly behind: number;
    readonly initial: boolean;
    readonly detached: boolean;
    readonly branch?: string;
    readonly upstream?: string;
    readonly entries: readonly {
        readonly code: string;
        readonly path: string;
        readonly staged: boolean;
        readonly unstaged: boolean;
        readonly untracked: boolean;
        readonly originPath?: string;
    }[];
}
/** JSON view of {@link GitDiffResult}. */
export interface GitDiffJson {
    readonly staged: boolean;
    readonly patch: string;
    readonly truncated: boolean;
    readonly path?: string;
}
/** JSON view of {@link GitLogResult}. */
export interface GitLogJson {
    readonly entries: readonly {
        readonly hash: string;
        readonly shortHash: string;
        readonly author: string;
        readonly date: string;
        readonly subject: string;
    }[];
}
/** JSON view of {@link GitBranchListResult}. */
export interface GitBranchListJson {
    readonly branches: readonly {
        readonly name: string;
        readonly current: boolean;
        readonly shortHash: string;
        readonly upstream?: string;
    }[];
}
/** JSON view of {@link GitStageResult}. */
export interface GitStageJson {
    readonly stagedPaths: readonly string[];
}
/** Project one status summary onto its JSON view. */
export declare function toStatusJson(summary: GitStatusSummary): GitStatusJson;
/** Project one diff result onto its JSON view. */
export declare function toDiffJson(result: GitDiffResult): GitDiffJson;
/** Project one log result onto its JSON view. */
export declare function toLogJson(result: GitLogResult): GitLogJson;
/** Project one branch list onto its JSON view. */
export declare function toBranchesJson(result: GitBranchListResult): GitBranchListJson;
/** Project one staging result onto its JSON view. */
export declare function toStageJson(result: GitStageResult): GitStageJson;
//# sourceMappingURL=json.d.ts.map