/**
 * Pure parsers for the NUL-delimited git formats the local provider runs:
 * `status --porcelain=v1 -z --branch`, `log --format` with unit/field
 * separators, and `for-each-ref` with NUL separators. No I/O — every function
 * is a pure projection of one command's output, so tests cover the formats
 * without spawning git.
 *
 * @module @dsh-custom/dsh-git-local
 */
import type { GitBranch, GitLogEntry, GitStatusEntry } from '@dsh-custom/dsh-git';
/** Branch header facts carried by `status --branch`. */
export interface StatusHeader {
    readonly branch: string | undefined;
    readonly upstream: string | undefined;
    readonly ahead: number;
    readonly behind: number;
    readonly initial: boolean;
    readonly detached: boolean;
}
/** `parseStatusZ` result: header plus entries. */
export interface ParsedStatus extends StatusHeader {
    readonly entries: readonly GitStatusEntry[];
}
/**
 * Parse `git status --porcelain=v1 -z --branch` output. The first record is
 * the `## ` header when `--branch` produced one; each entry record is `XY <path>`,
 * and rename/copy entries carry their origin path as the next record.
 * @param output - raw stdout of the status command.
 */
export declare function parseStatusZ(output: string): ParsedStatus;
/**
 * Parse `git log --format='%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1e'` output.
 * @param output - raw stdout of the log command.
 */
export declare function parseLog(output: string): readonly GitLogEntry[];
/**
 * Parse `git for-each-ref --format='%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(objectname:short)' refs/heads` output.
 * @param output - raw stdout of the for-each-ref command.
 */
export declare function parseBranches(output: string): readonly GitBranch[];
//# sourceMappingURL=parse.d.ts.map