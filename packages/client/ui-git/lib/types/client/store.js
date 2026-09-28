/**
 * The source-control panel's view state, one bucket per tab.
 *
 * Status, the selected file's diff, and one notice line are state the tab
 * owns — so they live in a Slot-standard exclusive store (one instance per
 * session), bucketed by tab id because two tabs of this kind in one session
 * select independently. Writers run between `start` and `forget`: the tab
 * record's `signal` is what ends a bucket's life.
 */
import { defineStore } from '@deepseek-ai/dsh-client-store';
/**
 * One tab's bucket, which every writer after `start` relies on.
 * @param state - the draft.
 * @param tabId - the tab being written.
 * @returns the tab's state.
 */
function bucket(state, tabId) {
    const tab = state.byTab[tabId];
    if (tab === undefined)
        throw new Error(`ui-git: no bucket for tab "${tabId}"`);
    return tab;
}
/**
 * Declare the panel's store.
 *
 * A factory rather than a shared handle: the registration declares it as an
 * exclusive store, so the framework mints one instance per session.
 * @returns the store handle to declare on the registration.
 */
export function createGitStore() {
    return defineStore({
        init: () => ({ byTab: {} }),
        actions: {
            start: (d, tabId) => {
                d.byTab[tabId] = { checkpoints: { kind: 'idle' }, status: { kind: 'loading' }, selected: undefined, selectedStaged: false, diff: { kind: 'idle' }, busy: false, notice: undefined, generating: false, generated: undefined };
            },
            statusLoading: (d, tabId) => {
                bucket(d, tabId).status = { kind: 'loading' };
            },
            statusReady: (d, tabId, view) => {
                const tab = bucket(d, tabId);
                tab.status = { kind: 'ready', view };
                // A refresh can retire the selected file; drop a diff that no longer
                // belongs to the reported entries.
                if (tab.selected !== undefined && !view.entries.some(entry => entry.path === tab.selected)) {
                    tab.selected = undefined;
                    tab.diff = { kind: 'idle' };
                }
            },
            statusFailed: (d, tabId, message, denied) => {
                bucket(d, tabId).status = { kind: 'failed', message, denied };
            },
            select: (d, tabId, path, staged) => {
                const tab = bucket(d, tabId);
                tab.selected = path;
                tab.selectedStaged = staged;
                tab.diff = { kind: 'loading' };
            },
            diffLoading: (d, tabId) => {
                bucket(d, tabId).diff = { kind: 'loading' };
            },
            diffReady: (d, tabId, patch, truncated) => {
                bucket(d, tabId).diff = { kind: 'ready', patch, truncated };
            },
            diffFailed: (d, tabId, message) => {
                bucket(d, tabId).diff = { kind: 'failed', message };
            },
            busy: (d, tabId, on) => {
                bucket(d, tabId).busy = on;
            },
            notice: (d, tabId, text) => {
                bucket(d, tabId).notice = text;
            },
            generating: (d, tabId, on) => {
                bucket(d, tabId).generating = on;
            },
            generated: (d, tabId, text) => {
                bucket(d, tabId).generated = text;
            },
            checkpointsLoading: (d, tabId) => {
                bucket(d, tabId).checkpoints = { kind: 'loading' };
            },
            checkpointsReady: (d, tabId, checkpoints) => {
                bucket(d, tabId).checkpoints = { kind: 'ready', checkpoints };
            },
            checkpointsFailed: (d, tabId, message) => {
                bucket(d, tabId).checkpoints = { kind: 'failed', message };
            },
            forget: (d, tabId) => {
                d.byTab = Object.fromEntries(Object.entries(d.byTab).filter(([id]) => id !== tabId));
            },
        },
    });
}
//# sourceMappingURL=store.js.map