/**
 * The automations panel's view state, one bucket per tab.
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit';
import type { AutomationView } from '@dsh-custom/dsh-automations-remote/types';
/** What the tab knows about the automation list. */
export type AutomationsListState = {
    readonly kind: 'idle';
} | {
    readonly kind: 'loading';
} | {
    readonly kind: 'ready';
    readonly automations: readonly AutomationView[];
} | {
    readonly kind: 'failed';
    readonly message: string;
};
/** One tab's panel state. */
export interface AutomationsTabState {
    list: AutomationsListState;
    /** A mutation is in flight; action buttons rest. */
    busy: boolean;
    /** The last failure's one-line rendering. */
    notice: string | undefined;
}
/** Every tab's state, keyed by tab id. */
export interface AutomationsState {
    byTab: Record<TabId, AutomationsTabState>;
}
/** The panel store's write set; every action names the tab it writes. */
type AutomationsActions = {
    start: (draft: AutomationsState, tabId: TabId) => void;
    loading: (draft: AutomationsState, tabId: TabId) => void;
    ready: (draft: AutomationsState, tabId: TabId, automations: readonly AutomationView[]) => void;
    failed: (draft: AutomationsState, tabId: TabId, message: string) => void;
    busy: (draft: AutomationsState, tabId: TabId, on: boolean) => void;
    notice: (draft: AutomationsState, tabId: TabId, text: string) => void;
    forget: (draft: AutomationsState, tabId: TabId) => void;
};
/**
 * Declare the panel's store (exclusive: one instance per session).
 * @returns the store handle to declare on the registration.
 */
export declare function createAutomationsStore(): EngineStoreHandle<AutomationsState, AutomationsActions>;
export {};
//# sourceMappingURL=store.d.ts.map