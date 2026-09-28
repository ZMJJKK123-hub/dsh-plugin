/**
 * The source-control panel's view state, one bucket per tab.
 *
 * Status, the selected file's diff, and one notice line are state the tab
 * owns — so they live in a Slot-standard exclusive store (one instance per
 * session), bucketed by tab id because two tabs of this kind in one session
 * select independently. Writers run between `start` and `forget`: the tab
 * record's `signal` is what ends a bucket's life.
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit';
import type { GitRemoteStatusView } from '@dsh-custom/dsh-git-remote/types';
/** What the tab knows about the repository status. */
export type GitStatusState = {
    readonly kind: 'idle';
} | {
    readonly kind: 'loading';
} | {
    readonly kind: 'ready';
    readonly view: GitRemoteStatusView;
} | {
    readonly kind: 'failed';
    readonly message: string;
    readonly denied: boolean;
};
/** What the tab knows about the selected file's diff. */
export type GitDiffState = {
    readonly kind: 'idle';
} | {
    readonly kind: 'loading';
} | {
    readonly kind: 'ready';
    readonly patch: string;
    readonly truncated: boolean;
} | {
    readonly kind: 'failed';
    readonly message: string;
};
/** What the tab knows about the session's checkpoints. */
export type GitCheckpointsState = {
    readonly kind: 'idle';
} | {
    readonly kind: 'loading';
} | {
    readonly kind: 'ready';
    readonly checkpoints: readonly {
        readonly index: number;
        readonly shortHash: string;
        readonly label: string;
        readonly date: string;
    }[];
} | {
    readonly kind: 'failed';
    readonly message: string;
};
/** One tab's panel state. */
export interface GitTabState {
    checkpoints: GitCheckpointsState;
    status: GitStatusState;
    /** Repository-relative path whose diff is open, when one is. */
    selected: string | undefined;
    /** Whether the open diff reads the staged side. */
    selectedStaged: boolean;
    diff: GitDiffState;
    /** A mutation is in flight; action buttons rest. */
    busy: boolean;
    /** The last settled action's one-line result. */
    notice: string | undefined;
    /** A commit-message draft is being generated. */
    generating: boolean;
    /** The latest generated draft; a change fills the commit box. */
    generated: string | undefined;
}
/** Every tab's state, keyed by tab id. */
export interface GitState {
    byTab: Record<TabId, GitTabState>;
}
/** The panel store's write set; every action names the tab it writes. */
type GitActions = {
    start: (draft: GitState, tabId: TabId) => void;
    statusLoading: (draft: GitState, tabId: TabId) => void;
    statusReady: (draft: GitState, tabId: TabId, view: GitRemoteStatusView) => void;
    statusFailed: (draft: GitState, tabId: TabId, message: string, denied: boolean) => void;
    select: (draft: GitState, tabId: TabId, path: string, staged: boolean) => void;
    diffLoading: (draft: GitState, tabId: TabId) => void;
    diffReady: (draft: GitState, tabId: TabId, patch: string, truncated: boolean) => void;
    diffFailed: (draft: GitState, tabId: TabId, message: string) => void;
    busy: (draft: GitState, tabId: TabId, on: boolean) => void;
    notice: (draft: GitState, tabId: TabId, text: string) => void;
    generating: (draft: GitState, tabId: TabId, on: boolean) => void;
    generated: (draft: GitState, tabId: TabId, text: string) => void;
    checkpointsLoading: (draft: GitState, tabId: TabId) => void;
    checkpointsReady: (draft: GitState, tabId: TabId, checkpoints: readonly {
        readonly index: number;
        readonly shortHash: string;
        readonly label: string;
        readonly date: string;
    }[]) => void;
    checkpointsFailed: (draft: GitState, tabId: TabId, message: string) => void;
    forget: (draft: GitState, tabId: TabId) => void;
};
/**
 * Declare the panel's store.
 *
 * A factory rather than a shared handle: the registration declares it as an
 * exclusive store, so the framework mints one instance per session.
 * @returns the store handle to declare on the registration.
 */
export declare function createGitStore(): EngineStoreHandle<GitState, GitActions>;
export {};
//# sourceMappingURL=store.d.ts.map