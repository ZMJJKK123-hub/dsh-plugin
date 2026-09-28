/**
 * Lossless-JSON projections of the seam's results: mutable arrays and
 * omitted-when-absent optional fields, the shape every wire surface (Remote
 * results, tool canonical values) must carry — a JSON snapshot drops an
 * explicit `undefined`, so absent optionals are omitted rather than nulled.
 *
 * @module @dsh-custom/dsh-git
 */
/** Project one status summary onto its JSON view. */
export function toStatusJson(summary) {
    return {
        root: summary.root,
        ahead: summary.ahead,
        behind: summary.behind,
        initial: summary.initial,
        detached: summary.detached,
        ...summary.branch !== undefined ? { branch: summary.branch } : {},
        ...summary.upstream !== undefined ? { upstream: summary.upstream } : {},
        entries: summary.entries.map(entry => ({
            code: entry.code,
            path: entry.path,
            staged: entry.staged,
            unstaged: entry.unstaged,
            untracked: entry.untracked,
            ...entry.originPath !== undefined ? { originPath: entry.originPath } : {},
        })),
    };
}
/** Project one diff result onto its JSON view. */
export function toDiffJson(result) {
    return {
        staged: result.staged,
        patch: result.patch,
        truncated: result.truncated,
        ...result.path !== undefined ? { path: result.path } : {},
    };
}
/** Project one log result onto its JSON view. */
export function toLogJson(result) {
    return { entries: result.entries.map(entry => ({ ...entry })) };
}
/** Project one branch list onto its JSON view. */
export function toBranchesJson(result) {
    return {
        branches: result.branches.map(branch => ({
            name: branch.name,
            current: branch.current,
            shortHash: branch.shortHash,
            ...branch.upstream !== undefined ? { upstream: branch.upstream } : {},
        })),
    };
}
/** Project one staging result onto its JSON view. */
export function toStageJson(result) {
    return { stagedPaths: result.stagedPaths.map(path => path) };
}
//# sourceMappingURL=json.js.map