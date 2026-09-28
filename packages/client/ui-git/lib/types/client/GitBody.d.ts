import type { ReactNode } from 'react';
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { GitInjected } from './face.ts';
import type { createGitStore } from './store.ts';
/** The body's composed props: the tab it draws, its store, its face, and its copy. */
export type GitBodyProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsStore<ReturnType<typeof createGitStore>> & GitInjected & PropsLocale<'gitPanel'>;
/** The source-control panel: everything one tab of this kind draws. */
export declare function GitBody({ useTabInfo, useStore, start, refresh, openDiff, stage, stageAll, unstage, commit, push, generateMessage, loadCheckpoints, restoreCheckpoint, t, }: GitBodyProps): ReactNode;
//# sourceMappingURL=GitBody.d.ts.map