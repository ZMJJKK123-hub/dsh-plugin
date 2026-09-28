/**
 * The panel's asynchronous half: every automationsRemote call, unwrapped from
 * the two envelopes (the carrier {@link RemoteResult}, then the namespace's
 * own discriminated result) and written through the store's actions. The
 * component never awaits anything.
 */
import type { BoundActions } from '@deepseek-ai/dsh-client-store';
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AutomationCreateRequest, AutomationListView, AutomationUpdateRequest, AutomationView, AutomationsRemoteResult } from '@dsh-custom/dsh-automations-remote/types';
import type { createAutomationsStore } from './store.ts';
/** The automationsRemote namespace's wire shape as the panel consumes it. */
export interface AutomationsRemoteFace {
    list(): Promise<RemoteResult<AutomationsRemoteResult<AutomationListView>>>;
    create(request: AutomationCreateRequest): Promise<RemoteResult<AutomationsRemoteResult<AutomationView>>>;
    update(request: AutomationUpdateRequest): Promise<RemoteResult<AutomationsRemoteResult<AutomationView>>>;
    deleteAutomation(request: {
        id: string;
    }): Promise<RemoteResult<AutomationsRemoteResult<null>>>;
    runNow(request: {
        id: string;
    }): Promise<RemoteResult<AutomationsRemoteResult<null>>>;
}
/** What the tab's body calls; every gesture is fire-and-forget. */
export interface AutomationsInjected {
    readonly start: (tabId: TabId, signal: AbortSignal) => void;
    readonly refresh: (tabId: TabId, signal: AbortSignal) => void;
    readonly create: (tabId: TabId, request: AutomationCreateRequest, signal: AbortSignal) => void;
    readonly setEnabled: (tabId: TabId, id: string, enabled: boolean, signal: AbortSignal) => void;
    readonly remove: (tabId: TabId, id: string, signal: AbortSignal) => void;
    readonly runNow: (tabId: TabId, id: string, signal: AbortSignal) => void;
}
/** Localized failure line the component supplies. */
export interface AutomationsLabels {
    readonly failed: (message: string) => string;
}
/**
 * Bind the panel's face to the automationsRemote namespace.
 * @param remote - the mounted automationsRemote Remote namespace.
 * @returns the Slot `inject` factory: session and bound actions in, face out.
 */
export declare function automationsFace(remote: AutomationsRemoteFace): (sessionId: string, actions: BoundActions<ReturnType<typeof createAutomationsStore>>) => AutomationsInjected;
//# sourceMappingURL=face.d.ts.map