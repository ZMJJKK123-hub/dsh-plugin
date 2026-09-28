/**
 * Service Definition for the `ctx.git` capability seam: repository facts
 * (status, diff, log, branches) and index/commit/push mutations shared by
 * model-facing tools and UI panels. Read methods take the repository
 * directory per call — the caller resolves the session workspace — and never
 * write to the repository; write methods (stage, unstage, commit, push) run
 * under the caller's standing sandbox policy and deny honestly under a
 * read-only mode.
 *
 * @module @dsh-custom/dsh-git
 */
import { Service } from '@deepseek-ai/cordis';
export { GitError } from "./types.js";
/**
 * Abstract git repository service. Subclass, implement the abstract methods,
 * and load the subclass as a plugin — it registers as `ctx.git` (one
 * implementation per context; loading a second throws, which is cordis'
 * standard duplicate-service behavior).
 *
 * Implementations must honor these semantics:
 * - The fact methods (root/status/diff/log/branches) only read; they create
 *   no commits, touch no index, and move no HEAD.
 * - The mutation methods (stage/unstage/commit/push) change the index, the
 *   commit graph, or the remote, and must enforce the caller's standing file
 *   policy: a read-only policy denies them with a {@link GitError} whose
 *   `denied` flag is set.
 * - Methods reject with {@link GitError} when git itself fails (nonzero exit,
 *   bad revision); infrastructure failures (spawn failure) reject with the
 *   underlying error. A directory outside any repository makes
 *   {@link GitService.resolveRoot} resolve `undefined` and the other methods
 *   reject with a {@link GitError}.
 */
export class GitService extends Service {
    constructor(ctx) {
        super(ctx, 'git');
    }
}
export default GitService;
//# sourceMappingURL=index.js.map