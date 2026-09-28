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
export class GitError extends Error {
    /** git's exit code, or null when the process died from a signal. */
    exitCode;
    /** git's stderr text (possibly truncated by the output cap). */
    stderr;
    /** True when a sandbox denial, not a git failure, produced this error. */
    denied;
    constructor(message, exitCode, stderr, denied = false) {
        super(message);
        this.name = 'GitError';
        this.exitCode = exitCode;
        this.stderr = stderr;
        this.denied = denied;
    }
}
//# sourceMappingURL=types.js.map