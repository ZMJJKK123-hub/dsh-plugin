/**
 * Client-side data access for the changes panel: a per-session controller
 * over the changeMonitor Remote with small caches and a bounded poll for the
 * turn whose record the Host may still be settling. Every failure degrades
 * to "no changes" — the panel is decoration, never an error surface.
 * @module @dsh-custom/dsh-client-ui-change-monitor/client
 */
/**
 * How long one summary poll keeps trying while the Host settles the turn.
 * A fast phase covers the common sub-second settle; a slow phase then keeps
 * waiting for large workspaces whose snapshots take tens of seconds. The
 * budget is bounded so a dead record degrades to "no changes" eventually.
 */
const POLL_FAST_ATTEMPTS = 40;
const POLL_FAST_INTERVAL_MS = 250;
const POLL_SLOW_ATTEMPTS = 60;
const POLL_SLOW_INTERVAL_MS = 2000;
/** Wait between poll attempts. */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * One session's changes: summaries per turn and full file diffs per path.
 * Caches live for the plugin instance and are dropped on `connection/reset`.
 */
export class ChangeMonitorController {
    remote;
    sessionId;
    summaries = new Map();
    files = new Map();
    summaryRequests = new Map();
    fileRequests = new Map();
    /**
     * @param remote - the mounted changeMonitor Remote namespace.
     * @param sessionId - the session this controller serves.
     */
    constructor(remote, sessionId) {
        this.remote = remote;
        this.sessionId = sessionId;
    }
    /**
     * One completed turn's change-set summary, polling while the Host settles.
     * @param turn - turn number to read.
     * @returns the summary, or null when the turn has no record (or the poll failed).
     */
    summaryFor(turn) {
        const cached = this.summaries.get(turn);
        if (cached !== undefined)
            return Promise.resolve(cached);
        const pending = this.summaryRequests.get(turn);
        if (pending !== undefined)
            return pending;
        const request = this.pollSummary(turn);
        this.summaryRequests.set(turn, request);
        return request.finally(() => { this.summaryRequests.delete(turn); });
    }
    async pollSummary(turn) {
        const attempts = POLL_FAST_ATTEMPTS + POLL_SLOW_ATTEMPTS;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            // Two envelopes: the carrier RemoteResult first, then the host's own
            // business result. A business `not-found` is a settled absence — poll
            // on, exactly like the still-settling null.
            const carried = await this.remote.turn({ sessionId: this.sessionId, turn });
            if (carried.ok && carried.value.ok && carried.value.value !== null) {
                this.summaries.set(turn, carried.value.value);
                return carried.value.value;
            }
            const interval = attempt < POLL_FAST_ATTEMPTS ? POLL_FAST_INTERVAL_MS : POLL_SLOW_INTERVAL_MS;
            await wait(interval);
        }
        this.summaries.set(turn, null);
        return null;
    }
    /**
     * One file's full diff inside one turn.
     * @param turn - turn the change belongs to.
     * @param path - workspace-relative file path.
     * @returns the file change with hunks, or null when unavailable.
     */
    fileFor(turn, path) {
        const key = `${turn}:${path}`;
        const cached = this.files.get(key);
        if (cached !== undefined)
            return Promise.resolve(cached);
        const pending = this.fileRequests.get(key);
        if (pending !== undefined)
            return pending;
        const request = this.remote.file({ sessionId: this.sessionId, turn, path })
            .then((carried) => {
            const value = carried.ok && carried.value.ok ? carried.value.value : null;
            this.files.set(key, value);
            return value;
        })
            .catch(() => {
            this.files.set(key, null);
            return null;
        });
        this.fileRequests.set(key, request);
        return request.finally(() => { this.fileRequests.delete(key); });
    }
    /** Drop every cached fact; called on connection reset. */
    invalidate() {
        this.summaries.clear();
        this.files.clear();
    }
}
//# sourceMappingURL=controller.js.map