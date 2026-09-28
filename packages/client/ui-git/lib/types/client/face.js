/** Unwrap the two envelopes into one answer. */
async function unwrap(carried) {
    if (!carried.ok)
        return { ok: false, message: carried.error.message, denied: false };
    const domain = carried.value;
    if (!domain.ok)
        return { ok: false, message: domain.error, denied: domain.denied === true };
    return { ok: true, view: domain.value };
}
/**
 * Bind the panel's face to the gitRemote namespace.
 * @param remote - the mounted gitRemote Remote namespace.
 * @returns the Slot `inject` factory: session and bound actions in, face out.
 */
export function gitFace(remote) {
    return (sessionId, actions) => {
        // The seat hands the raw session id string; the wire requests carry the brand.
        const session = sessionId;
        /** Read the status into the store; failures land renderable. */
        const refresh = (tabId, signal) => {
            if (signal.aborted)
                return;
            actions.statusLoading(tabId);
            void remote.status({ sessionId: session }).then(async (carried) => {
                if (signal.aborted)
                    return;
                const answer = await unwrap(carried);
                if (answer.ok)
                    actions.statusReady(tabId, answer.view);
                else
                    actions.statusFailed(tabId, answer.message, answer.denied);
            });
        };
        /** Run one mutation under the busy guard, then refresh. */
        const mutate = (tabId, signal, run) => {
            if (signal.aborted)
                return;
            actions.busy(tabId, true);
            void run().catch(() => { }).finally(() => {
                if (!signal.aborted) {
                    actions.busy(tabId, false);
                    refresh(tabId, signal);
                }
            });
        };
        return {
            start(tabId, signal) {
                actions.start(tabId);
                signal.addEventListener('abort', () => actions.forget(tabId), { once: true });
                refresh(tabId, signal);
            },
            refresh,
            openDiff(tabId, path, staged, signal) {
                if (signal.aborted)
                    return;
                actions.select(tabId, path, staged);
                void remote.diff({ sessionId: session, staged, path }).then(async (carried) => {
                    if (signal.aborted)
                        return;
                    const answer = await unwrap(carried);
                    if (answer.ok)
                        actions.diffReady(tabId, answer.view.patch, answer.view.truncated);
                    else
                        actions.diffFailed(tabId, answer.message);
                });
            },
            stage(tabId, path, signal) {
                mutate(tabId, signal, async () => { await remote.stage({ sessionId: session, paths: [path] }); });
            },
            stageAll(tabId, signal) {
                mutate(tabId, signal, async () => { await remote.stage({ sessionId: session, all: true }); });
            },
            unstage(tabId, path, signal) {
                mutate(tabId, signal, async () => { await remote.unstage({ sessionId: session, paths: [path] }); });
            },
            commit(tabId, message, labels, signal) {
                mutate(tabId, signal, async () => {
                    const answer = await unwrap(await remote.commit({ sessionId: session, message }));
                    actions.notice(tabId, answer.ok
                        ? labels.committed(answer.view.shortHash, answer.view.subject)
                        : answer.denied ? labels.denied : labels.failed(answer.message));
                });
            },
            push(tabId, labels, signal) {
                mutate(tabId, signal, async () => {
                    const answer = await unwrap(await remote.push({ sessionId: session }));
                    actions.notice(tabId, answer.ok
                        ? labels.pushed(answer.view.remote, answer.view.branch)
                        : answer.denied ? labels.denied : labels.failed(answer.message));
                });
            },
            loadCheckpoints(tabId, signal) {
                if (signal.aborted)
                    return;
                actions.checkpointsLoading(tabId);
                void remote.checkpoints({ sessionId: session }).then(async (carried) => {
                    if (signal.aborted)
                        return;
                    const answer = await unwrap(carried);
                    if (answer.ok)
                        actions.checkpointsReady(tabId, answer.view.checkpoints);
                    else
                        actions.checkpointsFailed(tabId, answer.message);
                });
            },
            restoreCheckpoint(tabId, index, labels, signal) {
                mutate(tabId, signal, async () => {
                    const answer = await unwrap(await remote.restoreCheckpoint({ sessionId: session, index }));
                    if (answer.ok) {
                        actions.notice(tabId, labels.restored());
                        actions.checkpointsLoading(tabId);
                        const relisted = await unwrap(await remote.checkpoints({ sessionId: session }));
                        if (relisted.ok)
                            actions.checkpointsReady(tabId, relisted.view.checkpoints);
                    }
                    else {
                        actions.notice(tabId, answer.denied ? labels.denied : labels.failed(answer.message));
                    }
                });
            },
            generateMessage(tabId, labels, signal) {
                if (signal.aborted)
                    return;
                actions.generating(tabId, true);
                void remote.generateCommitMessage({ sessionId: session }).then(async (carried) => {
                    if (signal.aborted)
                        return;
                    const answer = await unwrap(carried);
                    actions.generating(tabId, false);
                    if (answer.ok)
                        actions.generated(tabId, answer.view.message);
                    else
                        actions.notice(tabId, answer.denied ? labels.denied : labels.failed(answer.message));
                }).catch(() => {
                    if (!signal.aborted)
                        actions.generating(tabId, false);
                });
            },
        };
    };
}
//# sourceMappingURL=face.js.map