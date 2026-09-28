import { Service } from "@deepseek-ai/cordis";
//#region lib/types/types.js
/**
* Types of the `ctx.git` capability seam. This package is the Service
* Definition only: it declares what repository facts a provider must supply
* and never runs git itself. The local provider lives in
* `@dsh-custom/dsh-git-local`; model-facing tools and UI panels consume this
* interface so a future remote-provider swap needs no consumer changes.
*
* @module @dsh-custom/dsh-git
*/
/**
* A git command failed. Carries the raw exit code and stderr so consumers can
* surface the honest cause; `denied` marks a run the sandbox blocked before
* git could finish, which is policy working, not a git error.
*/
var GitError = class extends Error {
	/** git's exit code, or null when the process died from a signal. */
	exitCode;
	/** git's stderr text (possibly truncated by the output cap). */
	stderr;
	/** True when a sandbox denial, not a git failure, produced this error. */
	denied;
	constructor(message, exitCode, stderr, denied = false) {
		super(message);
		this.name = "GitError";
		this.exitCode = exitCode;
		this.stderr = stderr;
		this.denied = denied;
	}
};
//#endregion
//#region lib/types/index.js
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
var GitService = class extends Service {
	constructor(ctx) {
		super(ctx, "git");
	}
};
//#endregion
export { GitError, GitService, GitService as default };
