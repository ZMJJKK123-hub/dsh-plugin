/**
 * The automations panel's view state, one bucket per tab.
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
        throw new Error(`ui-automations: no bucket for tab "${tabId}"`);
    return tab;
}
/**
 * Declare the panel's store (exclusive: one instance per session).
 * @returns the store handle to declare on the registration.
 */
export function createAutomationsStore() {
    return defineStore({
        init: () => ({ byTab: {} }),
        actions: {
            start: (d, tabId) => {
                d.byTab[tabId] = { list: { kind: 'loading' }, busy: false, notice: undefined };
            },
            loading: (d, tabId) => {
                bucket(d, tabId).list = { kind: 'loading' };
            },
            ready: (d, tabId, automations) => {
                bucket(d, tabId).list = { kind: 'ready', automations };
            },
            failed: (d, tabId, message) => {
                bucket(d, tabId).list = { kind: 'failed', message };
            },
            busy: (d, tabId, on) => {
                bucket(d, tabId).busy = on;
            },
            notice: (d, tabId, text) => {
                bucket(d, tabId).notice = text;
            },
            forget: (d, tabId) => {
                d.byTab = Object.fromEntries(Object.entries(d.byTab).filter(([id]) => id !== tabId));
            },
        },
    });
}
//# sourceMappingURL=store.js.map