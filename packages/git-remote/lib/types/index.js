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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import z from '@deepseek-ai/schemastery';
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm';
import { deadline } from '@deepseek-ai/dsh-timeout';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { GitError } from '@dsh-custom/dsh-git';
/**
 * Run one seam call and project it onto the wire result: a `GitError`
 * becomes the failure the panel renders (with `denied` for policy blocks),
 * any other throw becomes an honest infrastructure failure message.
 * @param body - one seam call returning the wire view.
 */
async function answer(body) {
    try {
        return { ok: true, value: await body() };
    }
    catch (error) {
        if (error instanceof GitError) {
            return {
                ok: false,
                error: error.message,
                ...error.denied ? { denied: true } : {},
            };
        }
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
/** Project one status summary onto its wire view. */
function statusView(summary) {
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
/** Project one diff result onto its wire view. */
function diffView(result) {
    return {
        staged: result.staged,
        patch: result.patch,
        truncated: result.truncated,
        ...result.path !== undefined ? { path: result.path } : {},
    };
}
/** Project one log result onto its wire view. */
function logView(result) {
    return { entries: result.entries.map(entry => ({ ...entry })) };
}
/** Project one branch list onto its wire view. */
function branchesView(result) {
    return {
        branches: result.branches.map(branch => ({
            name: branch.name,
            current: branch.current,
            shortHash: branch.shortHash,
            ...branch.upstream !== undefined ? { upstream: branch.upstream } : {},
        })),
    };
}
/** Project one staging result onto its wire view. */
function stageView(result) {
    return { stagedPaths: result.stagedPaths.map(path => path) };
}
/** System prompt for the auxiliary commit-message completion. */
const COMMIT_MESSAGE_SYSTEM = [
    'You write git commit messages.',
    'Reply with ONLY the commit message: one concise subject line (at most 72 characters, imperative mood, no trailing period),',
    'optionally followed by a blank line and a short body explaining what changed and why.',
    'No surrounding quotes, no markdown code fences, no commentary.',
].join(' ');
/** Cap of the normalized message the service ever returns. */
const MAX_MESSAGE_LENGTH = 1_000;
/**
 * Normalize one model reply into commit-message text: strip code fences and
 * stray quoting, collapse blank runs, and cap the length.
 * @param text - the assembled model text.
 * @returns the normalized message.
 */
function normalizeCommitMessage(text) {
    let message = text.trim();
    const fenced = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/.exec(message);
    if (fenced !== null)
        message = fenced[1]?.trim() ?? message;
    message = message.replace(/^["'`]+|[`"']+$/g, '').replace(/\n{3,}/g, '\n\n').trim();
    return message.slice(0, MAX_MESSAGE_LENGTH);
}
/**
 * Translate one terminal finish reason into the auxiliary-call failure.
 * @param finish - the assembled stream's terminal reason.
 * @returns the failure, or undefined for a clean stop.
 */
function finishError(finish) {
    switch (finish.kind) {
        case 'stop':
            return undefined;
        case 'error':
        case 'aborted':
            return new Error(finish.failure.message);
        case 'max-tokens':
            return new Error('git-remote: commit message reached maxOutputTokens');
        case 'tool-calls':
            return new Error('git-remote: commit message model unexpectedly requested a tool');
    }
}
let GitRemoteService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _status_decorators;
    let _diff_decorators;
    let _log_decorators;
    let _branches_decorators;
    let _stage_decorators;
    let _unstage_decorators;
    let _commit_decorators;
    let _push_decorators;
    let _generateCommitMessage_decorators;
    let _checkpoints_decorators;
    let _restoreCheckpoint_decorators;
    return class GitRemoteService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _status_decorators = [Remote('status')];
            _diff_decorators = [Remote('diff')];
            _log_decorators = [Remote('log')];
            _branches_decorators = [Remote('branches')];
            _stage_decorators = [Remote('stage')];
            _unstage_decorators = [Remote('unstage')];
            _commit_decorators = [Remote('commit')];
            _push_decorators = [Remote('push')];
            _generateCommitMessage_decorators = [Remote('generateCommitMessage')];
            _checkpoints_decorators = [Remote('checkpoints')];
            _restoreCheckpoint_decorators = [Remote('restoreCheckpoint')];
            __esDecorate(this, null, _status_decorators, { kind: "method", name: "status", static: false, private: false, access: { has: obj => "status" in obj, get: obj => obj.status }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _diff_decorators, { kind: "method", name: "diff", static: false, private: false, access: { has: obj => "diff" in obj, get: obj => obj.diff }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _log_decorators, { kind: "method", name: "log", static: false, private: false, access: { has: obj => "log" in obj, get: obj => obj.log }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _branches_decorators, { kind: "method", name: "branches", static: false, private: false, access: { has: obj => "branches" in obj, get: obj => obj.branches }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _stage_decorators, { kind: "method", name: "stage", static: false, private: false, access: { has: obj => "stage" in obj, get: obj => obj.stage }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _unstage_decorators, { kind: "method", name: "unstage", static: false, private: false, access: { has: obj => "unstage" in obj, get: obj => obj.unstage }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _commit_decorators, { kind: "method", name: "commit", static: false, private: false, access: { has: obj => "commit" in obj, get: obj => obj.commit }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _push_decorators, { kind: "method", name: "push", static: false, private: false, access: { has: obj => "push" in obj, get: obj => obj.push }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _generateCommitMessage_decorators, { kind: "method", name: "generateCommitMessage", static: false, private: false, access: { has: obj => "generateCommitMessage" in obj, get: obj => obj.generateCommitMessage }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _checkpoints_decorators, { kind: "method", name: "checkpoints", static: false, private: false, access: { has: obj => "checkpoints" in obj, get: obj => obj.checkpoints }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _restoreCheckpoint_decorators, { kind: "method", name: "restoreCheckpoint", static: false, private: false, access: { has: obj => "restoreCheckpoint" in obj, get: obj => obj.restoreCheckpoint }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['sessions', 'git', 'llm'];
        static Config = z.object({
            provider: z.string(),
            model: z.string(),
            maxDiffBytes: z.number().default(65_536),
            maxOutputTokens: z.number().default(128),
            timeoutMs: z.number().default(60_000),
        });
        config = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, config = {}) {
            super(ctx, 'gitRemote');
            this.config = {
                maxDiffBytes: config.maxDiffBytes ?? 65_536,
                maxOutputTokens: config.maxOutputTokens ?? 128,
                timeoutMs: config.timeoutMs ?? 60_000,
                ...config.provider !== undefined ? { provider: config.provider } : {},
                ...config.model !== undefined ? { model: config.model } : {},
            };
        }
        /**
         * Resolve the workspace directory of one live session.
         * @param sessionId - the session whose repository the call addresses.
         * @returns the cwd, or the ready-made failure answer when the session is
         * unknown or carries no cwd.
         */
        resolve(sessionId) {
            const session = this.ctx.sessions.get(sessionId);
            const cwd = session?.header.cwd;
            if (cwd === undefined || cwd === '') {
                return { failure: { ok: false, error: `session ${String(sessionId)} has no workspace directory` } };
            }
            return { cwd };
        }
        /**
         * `gitRemote.status`: the session repository's working-tree status.
         * @param request - the session whose repository to read.
         * @returns the status view, or the failure the panel renders.
         */
        async status(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            return await answer(async () => statusView(await this.ctx.git.status(cwd)));
        }
        /**
         * `gitRemote.diff`: one unified diff of the session repository.
         * @param request - the session, staged/work-tree selection, and optional path filter.
         * @returns the patch view, or the failure the panel renders.
         */
        async diff(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            return await answer(async () => diffView(await this.ctx.git.diff(cwd, {
                staged: request.staged === true,
                ...request.path !== undefined && request.path !== '' ? { path: request.path } : {},
            })));
        }
        /**
         * `gitRemote.log`: the session repository's commit list.
         * @param request - the session, count bound, optional revision and path filter.
         * @returns the commit list view, or the failure the panel renders.
         */
        async log(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            return await answer(async () => logView(await this.ctx.git.log(cwd, {
                ...request.maxCount !== undefined ? { maxCount: request.maxCount } : {},
                ...request.ref !== undefined && request.ref !== '' ? { ref: request.ref } : {},
                ...request.path !== undefined && request.path !== '' ? { path: request.path } : {},
            })));
        }
        /**
         * `gitRemote.branches`: the session repository's local branches.
         * @param request - the session whose repository to read.
         * @returns the branch list view, or the failure the panel renders.
         */
        async branches(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            return await answer(async () => branchesView(await this.ctx.git.branches(cwd)));
        }
        /**
         * `gitRemote.stage`: stage work-tree changes into the index.
         * @param request - the session and the paths (or the whole work tree).
         * @returns the cumulative staged paths, or the failure the panel renders.
         */
        async stage(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            return await answer(async () => stageView(await this.ctx.git.stage(cwd, {
                ...request.paths !== undefined && request.paths.length > 0 ? { paths: request.paths } : {},
                ...request.all === true ? { all: true } : {},
            })));
        }
        /**
         * `gitRemote.unstage`: return index entries to HEAD.
         * @param request - the session and the paths (or the whole index).
         * @returns the cumulative staged paths, or the failure the panel renders.
         */
        async unstage(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            return await answer(async () => stageView(await this.ctx.git.unstage(cwd, {
                ...request.paths !== undefined && request.paths.length > 0 ? { paths: request.paths } : {},
                ...request.all === true ? { all: true } : {},
            })));
        }
        /**
         * `gitRemote.commit`: create one commit from the staged index.
         * @param request - the session and the commit message.
         * @returns the created commit's identity, or the failure the panel renders.
         */
        async commit(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            return await answer(async () => {
                const result = await this.ctx.git.commit(cwd, { message: request.message });
                return { hash: result.hash, shortHash: result.shortHash, subject: result.subject };
            });
        }
        /**
         * `gitRemote.push`: push the current branch to its upstream or an explicit remote.
         * @param request - the session, optional remote/branch, and upstream setup.
         * @returns the push target echo, or the failure the panel renders.
         */
        async push(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            return await answer(async () => {
                const result = await this.ctx.git.push(cwd, {
                    ...request.remote !== undefined && request.remote !== '' ? { remote: request.remote } : {},
                    ...request.branch !== undefined && request.branch !== '' ? { branch: request.branch } : {},
                    ...request.setUpstream === true ? { setUpstream: true } : {},
                });
                return { remote: result.remote, branch: result.branch, setUpstream: result.setUpstream };
            });
        }
        /**
         * `gitRemote.generateCommitMessage`: one auxiliary model completion that
         * drafts the commit message from the staged diff. Requires the
         * provider+model route to be configured on this row; without it the answer
         * is the honest not-configured failure.
         * @param request - the session whose staged diff to frame.
         * @returns the drafted message, or the failure the panel renders.
         */
        async generateCommitMessage(request) {
            const provider = this.config.provider;
            const model = this.config.model;
            if (provider === undefined || model === undefined) {
                return { ok: false, error: 'git-remote: commit-message generation is not configured; set provider and model together on the git-remote row' };
            }
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            return await answer(async () => {
                const env_1 = { stack: [], error: void 0, hasError: false };
                try {
                    const diff = await this.ctx.git.diff(cwd, { staged: true, maxBytes: this.config.maxDiffBytes });
                    if (diff.patch.trim() === '') {
                        throw new GitError('nothing is staged; stage changes before generating a commit message', 1, '');
                    }
                    const userText = `Write the commit message for these staged changes:\n\n${diff.patch}\n${diff.truncated ? '\n(the diff was truncated at its tail)\n' : ''}`;
                    const messages = [createUserMessage({
                            content: [{ type: 'text', text: userText }],
                            source: { kind: 'plugin', plugin: 'dsh-git-remote' },
                        })];
                    const callDeadline = __addDisposableResource(env_1, deadline(undefined, this.config.timeoutMs, 'GIT_COMMIT_MESSAGE_TIMEOUT'), false);
                    const options = {
                        provider,
                        model,
                        messages,
                        system: COMMIT_MESSAGE_SYSTEM,
                        maxTokens: this.config.maxOutputTokens,
                        signal: callDeadline.signal,
                    };
                    const assembler = new BlockAssembler();
                    for await (const chunk of this.ctx.llm.stream(options)) {
                        callDeadline.signal.throwIfAborted();
                        assembler.push(chunk);
                    }
                    const terminalError = finishError(assembler.finish);
                    if (terminalError !== undefined)
                        throw terminalError;
                    const blocks = assembler.blocks();
                    if (blocks.some(block => block.type === 'tool-call')) {
                        throw new Error('git-remote: the commit-message model returned a tool call');
                    }
                    const text = blocks
                        .filter((block) => block.type === 'text')
                        .map(block => block.text)
                        .join(' ');
                    const message = normalizeCommitMessage(text);
                    if (message === '')
                        throw new Error('git-remote: the commit-message model produced no text');
                    return { message };
                }
                catch (e_1) {
                    env_1.error = e_1;
                    env_1.hasError = true;
                }
                finally {
                    __disposeResources(env_1);
                }
            });
        }
        /**
         * `gitRemote.checkpoints`: the session's checkpoint series, newest first.
         * @param request - the session whose checkpoint series to read.
         * @returns the checkpoint list view, or the failure the panel renders.
         */
        async checkpoints(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            // The session id is the series key: one checkpoint timeline per session.
            const series = String(request.sessionId);
            return await answer(async () => {
                const listed = await this.ctx.git.checkpoints(cwd, series);
                return { checkpoints: listed.checkpoints.map(checkpoint => ({ ...checkpoint })) };
            });
        }
        /**
         * `gitRemote.restoreCheckpoint`: return work-tree files to one checkpoint.
         * @param request - the session, the checkpoint ordinal, and optional paths.
         * @returns the restored echo, or the failure the panel renders.
         */
        async restoreCheckpoint(request) {
            const resolved = this.resolve(request.sessionId);
            if ('failure' in resolved)
                return resolved.failure;
            const cwd = resolved.cwd;
            const series = String(request.sessionId);
            const paths = request.paths?.filter(path => path.trim() !== '') ?? [];
            return await answer(async () => {
                const result = await this.ctx.git.checkpointRestore(cwd, {
                    series,
                    index: request.index,
                    ...paths.length > 0 ? { paths } : {},
                });
                return { restored: result.restored.map(path => path) };
            });
        }
    };
})();
export { GitRemoteService };
export default GitRemoteService;
//# sourceMappingURL=index.js.map