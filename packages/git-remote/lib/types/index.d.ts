/**
 * Remote exposure of the `ctx.git` capability seam as the `gitRemote` Typert
 * Remote namespace for the Web Client: every request carries the session id —
 * this service resolves the workspace root from the live session, so the
 * panel always means the session's own repository — and every answer is a
 * discriminated result (`ok` carries the wire view, `false` carries the
 * panel-renderable error, with `denied` when the standing sandbox policy
 * blocked a mutation). A Remote call never rejects.
 *
 * `generateCommitMessage` adds one auxiliary model call: it frames the staged
 * diff, streams exactly one completion through `ctx.llm` under the configured
 * provider+model route, and normalizes the reply into commit-message text.
 * With no route configured it answers the honest not-configured failure.
 *
 * @module @dsh-custom/dsh-git-remote
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { GitRemoteBranchListView, GitRemoteCheckpointListView, GitRemoteCheckpointListRequest, GitRemoteCheckpointRestoreRequest, GitRemoteCommitRequest, GitRemoteCommitView, GitRemoteDiffRequest, GitRemoteDiffView, GitRemoteGeneratedMessageView, GitRemoteLogRequest, GitRemoteLogView, GitRemotePushRequest, GitRemotePushView, GitRemoteResult, GitRemoteSessionRequest, GitRemoteStageRequest, GitRemoteStageView, GitRemoteStatusView } from './types.ts';
export type { GitRemoteBranch, GitRemoteBranchListView, GitRemoteCheckpoint, GitRemoteCheckpointListView, GitRemoteCheckpointListRequest, GitRemoteCheckpointRestoreRequest, GitRemoteCommitRequest, GitRemoteCommitView, GitRemoteDiffRequest, GitRemoteDiffView, GitRemoteGeneratedMessageView, GitRemoteLogEntry, GitRemoteLogRequest, GitRemoteLogView, GitRemotePushRequest, GitRemotePushView, GitRemoteResult, GitRemoteSessionRequest, GitRemoteStageRequest, GitRemoteStageView, GitRemoteStatusEntry, GitRemoteStatusView, } from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        gitRemote: GitRemoteService;
    }
}
/** Plugin config (all optional — `static Config` supplies the defaults). */
export interface Config {
    /** Provider route for commit-message generation; must be paired with `model`. */
    provider?: string;
    /** Model id for commit-message generation; must be paired with `provider`. */
    model?: string;
    /** Cap of the staged diff fed to the model, in bytes. */
    maxDiffBytes?: number;
    /** Generation output-token cap. */
    maxOutputTokens?: number;
    /** End-to-end generation deadline in milliseconds. */
    timeoutMs?: number;
}
export declare class GitRemoteService extends TypertRemoteService {
    static inject: string[];
    static Config: z<Config>;
    private readonly config;
    constructor(ctx: Context, config?: Config);
    /**
     * Resolve the workspace directory of one live session.
     * @param sessionId - the session whose repository the call addresses.
     * @returns the cwd, or the ready-made failure answer when the session is
     * unknown or carries no cwd.
     */
    private resolve;
    /**
     * `gitRemote.status`: the session repository's working-tree status.
     * @param request - the session whose repository to read.
     * @returns the status view, or the failure the panel renders.
     */
    status(request: GitRemoteSessionRequest): Promise<GitRemoteResult<GitRemoteStatusView>>;
    /**
     * `gitRemote.diff`: one unified diff of the session repository.
     * @param request - the session, staged/work-tree selection, and optional path filter.
     * @returns the patch view, or the failure the panel renders.
     */
    diff(request: GitRemoteDiffRequest): Promise<GitRemoteResult<GitRemoteDiffView>>;
    /**
     * `gitRemote.log`: the session repository's commit list.
     * @param request - the session, count bound, optional revision and path filter.
     * @returns the commit list view, or the failure the panel renders.
     */
    log(request: GitRemoteLogRequest): Promise<GitRemoteResult<GitRemoteLogView>>;
    /**
     * `gitRemote.branches`: the session repository's local branches.
     * @param request - the session whose repository to read.
     * @returns the branch list view, or the failure the panel renders.
     */
    branches(request: GitRemoteSessionRequest): Promise<GitRemoteResult<GitRemoteBranchListView>>;
    /**
     * `gitRemote.stage`: stage work-tree changes into the index.
     * @param request - the session and the paths (or the whole work tree).
     * @returns the cumulative staged paths, or the failure the panel renders.
     */
    stage(request: GitRemoteStageRequest): Promise<GitRemoteResult<GitRemoteStageView>>;
    /**
     * `gitRemote.unstage`: return index entries to HEAD.
     * @param request - the session and the paths (or the whole index).
     * @returns the cumulative staged paths, or the failure the panel renders.
     */
    unstage(request: GitRemoteStageRequest): Promise<GitRemoteResult<GitRemoteStageView>>;
    /**
     * `gitRemote.commit`: create one commit from the staged index.
     * @param request - the session and the commit message.
     * @returns the created commit's identity, or the failure the panel renders.
     */
    commit(request: GitRemoteCommitRequest): Promise<GitRemoteResult<GitRemoteCommitView>>;
    /**
     * `gitRemote.push`: push the current branch to its upstream or an explicit remote.
     * @param request - the session, optional remote/branch, and upstream setup.
     * @returns the push target echo, or the failure the panel renders.
     */
    push(request: GitRemotePushRequest): Promise<GitRemoteResult<GitRemotePushView>>;
    /**
     * `gitRemote.generateCommitMessage`: one auxiliary model completion that
     * drafts the commit message from the staged diff. Requires the
     * provider+model route to be configured on this row; without it the answer
     * is the honest not-configured failure.
     * @param request - the session whose staged diff to frame.
     * @returns the drafted message, or the failure the panel renders.
     */
    generateCommitMessage(request: GitRemoteSessionRequest): Promise<GitRemoteResult<GitRemoteGeneratedMessageView>>;
    /**
     * `gitRemote.checkpoints`: the session's checkpoint series, newest first.
     * @param request - the session whose checkpoint series to read.
     * @returns the checkpoint list view, or the failure the panel renders.
     */
    checkpoints(request: GitRemoteCheckpointListRequest): Promise<GitRemoteResult<GitRemoteCheckpointListView>>;
    /**
     * `gitRemote.restoreCheckpoint`: return work-tree files to one checkpoint.
     * @param request - the session, the checkpoint ordinal, and optional paths.
     * @returns the restored echo, or the failure the panel renders.
     */
    restoreCheckpoint(request: GitRemoteCheckpointRestoreRequest): Promise<GitRemoteResult<{
        restored: readonly string[];
    }>>;
}
export default GitRemoteService;
//# sourceMappingURL=index.d.ts.map