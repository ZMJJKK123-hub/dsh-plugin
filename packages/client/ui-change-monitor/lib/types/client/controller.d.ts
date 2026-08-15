/**
 * Client-side data access for the changes panel: a per-session controller
 * over the changeMonitor Remote with small caches and a bounded poll for the
 * turn whose record the Host may still be settling. Every failure degrades
 * to "no changes" — the panel is decoration, never an error surface.
 * @module @deepseek-ai/dsh-client-ui-change-monitor/client
 */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { ChangeFileRequest, ChangeFileResult, ChangeSummaryResult, ChangeSetSummary, FileChange } from '@dsh-custom/dsh-change-monitor';
/**
 * The wire shape of the changeMonitor Remote namespace. Every generated Remote
 * method resolves to {@link RemoteResult}: the carrier envelope wraps the
 * host's own business result envelope, so consumers unwrap twice.
 */
export interface ChangeMonitorRemote {
    turn(request: {
        sessionId: SessionId;
        turn: number;
    }): Promise<RemoteResult<ChangeSummaryResult>>;
    file(request: ChangeFileRequest): Promise<RemoteResult<ChangeFileResult>>;
}
/**
 * One session's changes: summaries per turn and full file diffs per path.
 * Caches live for the plugin instance and are dropped on `connection/reset`.
 */
export declare class ChangeMonitorController {
    private readonly remote;
    private readonly sessionId;
    private readonly summaries;
    private readonly files;
    private readonly summaryRequests;
    private readonly fileRequests;
    /**
     * @param remote - the mounted changeMonitor Remote namespace.
     * @param sessionId - the session this controller serves.
     */
    constructor(remote: ChangeMonitorRemote, sessionId: SessionId);
    /**
     * One completed turn's change-set summary, polling while the Host settles.
     * @param turn - turn number to read.
     * @returns the summary, or null when the turn has no record (or the poll failed).
     */
    summaryFor(turn: number): Promise<ChangeSetSummary | null>;
    private pollSummary;
    /**
     * One file's full diff inside one turn.
     * @param turn - turn the change belongs to.
     * @param path - workspace-relative file path.
     * @returns the file change with hunks, or null when unavailable.
     */
    fileFor(turn: number, path: string): Promise<FileChange | null>;
    /** Drop every cached fact; called on connection reset. */
    invalidate(): void;
}
//# sourceMappingURL=controller.d.ts.map