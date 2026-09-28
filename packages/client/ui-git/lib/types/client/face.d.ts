/**
 * The panel's asynchronous half: every git Remote call, unwrapped from the
 * two envelopes (the carrier {@link RemoteResult}, then the host's own
 * `GitRemoteResult`) and written through the store's actions — the component
 * never awaits anything. Mutations guard on `busy`, then refresh the status.
 */
import type { BoundActions } from '@deepseek-ai/dsh-client-store';
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { GitRemoteCheckpointListView, GitRemoteCheckpointListRequest, GitRemoteCheckpointRestoreRequest, GitRemoteCommitRequest, GitRemoteCommitView, GitRemoteDiffRequest, GitRemoteDiffView, GitRemoteGeneratedMessageView, GitRemotePushRequest, GitRemotePushView, GitRemoteResult, GitRemoteSessionRequest, GitRemoteStageRequest, GitRemoteStageView, GitRemoteStatusView } from '@dsh-custom/dsh-git-remote/types';
import type { createGitStore } from './store.ts';
/** The gitRemote namespace's wire shape as the panel consumes it. */
export interface GitRemoteFace {
    status(request: GitRemoteSessionRequest): Promise<RemoteResult<GitRemoteResult<GitRemoteStatusView>>>;
    diff(request: GitRemoteDiffRequest): Promise<RemoteResult<GitRemoteResult<GitRemoteDiffView>>>;
    stage(request: GitRemoteStageRequest): Promise<RemoteResult<GitRemoteResult<GitRemoteStageView>>>;
    unstage(request: GitRemoteStageRequest): Promise<RemoteResult<GitRemoteResult<GitRemoteStageView>>>;
    commit(request: GitRemoteCommitRequest): Promise<RemoteResult<GitRemoteResult<GitRemoteCommitView>>>;
    push(request: GitRemotePushRequest): Promise<RemoteResult<GitRemoteResult<GitRemotePushView>>>;
    generateCommitMessage(request: GitRemoteSessionRequest): Promise<RemoteResult<GitRemoteResult<GitRemoteGeneratedMessageView>>>;
    checkpoints(request: GitRemoteCheckpointListRequest): Promise<RemoteResult<GitRemoteResult<GitRemoteCheckpointListView>>>;
    restoreCheckpoint(request: GitRemoteCheckpointRestoreRequest): Promise<RemoteResult<GitRemoteResult<{
        restored: readonly string[];
    }>>>;
}
/** Localized notice strings the component supplies to commit and push. */
export interface GitNoticeLabels {
    /** Compose the success line from the commit's short hash and subject. */
    readonly committed: (hash: string, subject: string) => string;
    /** Compose the success line from the push target. */
    readonly pushed: (remote: string, branch: string) => string;
    /** The restore success line. */
    readonly restored: () => string;
    /** The policy-blocked line. */
    readonly denied: string;
    /** Compose the failure line from the transport or domain message. */
    readonly failed: (message: string) => string;
}
/** What the tab's body calls; every gesture is fire-and-forget. */
export interface GitInjected {
    /** Seed the bucket and read the status. */
    readonly start: (tabId: TabId, signal: AbortSignal) => void;
    /** Re-read the status. */
    readonly refresh: (tabId: TabId, signal: AbortSignal) => void;
    /** Open one file's diff (staged or work-tree side). */
    readonly openDiff: (tabId: TabId, path: string, staged: boolean, signal: AbortSignal) => void;
    /** Stage one path, then refresh. */
    readonly stage: (tabId: TabId, path: string, signal: AbortSignal) => void;
    /** Stage everything, then refresh. */
    readonly stageAll: (tabId: TabId, signal: AbortSignal) => void;
    /** Unstage one path, then refresh. */
    readonly unstage: (tabId: TabId, path: string, signal: AbortSignal) => void;
    /** Commit the staged index with a message; the notice line carries the outcome. */
    readonly commit: (tabId: TabId, message: string, labels: GitNoticeLabels, signal: AbortSignal) => void;
    /** Push the current branch; the notice line carries the outcome. */
    readonly push: (tabId: TabId, labels: GitNoticeLabels, signal: AbortSignal) => void;
    /** Draft the commit message from the staged diff; the draft fills the commit box. */
    readonly generateMessage: (tabId: TabId, labels: GitNoticeLabels, signal: AbortSignal) => void;
    /** Load the session's checkpoint list into the store. */
    readonly loadCheckpoints: (tabId: TabId, signal: AbortSignal) => void;
    /** Restore the work tree from one checkpoint; the notice line carries the outcome. */
    readonly restoreCheckpoint: (tabId: TabId, index: number, labels: GitNoticeLabels, signal: AbortSignal) => void;
}
/**
 * Bind the panel's face to the gitRemote namespace.
 * @param remote - the mounted gitRemote Remote namespace.
 * @returns the Slot `inject` factory: session and bound actions in, face out.
 */
export declare function gitFace(remote: GitRemoteFace): (sessionId: string, actions: BoundActions<ReturnType<typeof createGitStore>>) => GitInjected;
//# sourceMappingURL=face.d.ts.map