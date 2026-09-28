/** Unwrap the two envelopes into one answer. */
async function unwrap(carried) {
    if (!carried.ok)
        return { ok: false, message: carried.error.message };
    const domain = carried.value;
    if (!domain.ok)
        return { ok: false, message: domain.error };
    return { ok: true, view: domain.value };
}
/**
 * Bind the panel's face to the automationsRemote namespace.
 * @param remote - the mounted automationsRemote Remote namespace.
 * @returns the Slot `inject` factory: session and bound actions in, face out.
 */
export function automationsFace(remote) {
    return (sessionId, actions) => {
        void sessionId;
        /** Read the list into the store; failures land renderable. */
        const refresh = (tabId, signal) => {
            if (signal.aborted)
                return;
            actions.loading(tabId);
            void remote.list().then(async (carried) => {
                if (signal.aborted)
                    return;
                const answer = await unwrap(carried);
                if (answer.ok)
                    actions.ready(tabId, answer.view.automations);
                else
                    actions.failed(tabId, answer.message);
            });
        };
        /** Run one mutation, then refresh the list. */
        const mutate = (tabId, signal, run, labels) => {
            if (signal.aborted)
                return;
            actions.busy(tabId, true);
            void run().then(async (answer) => {
                if (!signal.aborted) {
                    actions.busy(tabId, false);
                    if (!answer.ok && labels !== undefined)
                        actions.notice(tabId, labels.failed(answer.message));
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
            create(tabId, request, signal) {
                mutate(tabId, signal, () => remote.create(request).then(unwrap));
            },
            setEnabled(tabId, id, enabled, signal) {
                mutate(tabId, signal, () => remote.update({ id, enabled }).then(unwrap));
            },
            remove(tabId, id, signal) {
                mutate(tabId, signal, () => remote.deleteAutomation({ id }).then(unwrap));
            },
            runNow(tabId, id, signal) {
                mutate(tabId, signal, () => remote.runNow({ id }).then(unwrap));
            },
        };
    };
}
//# sourceMappingURL=face.js.map