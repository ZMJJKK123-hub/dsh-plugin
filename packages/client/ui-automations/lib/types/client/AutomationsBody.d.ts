import type { ReactNode } from 'react';
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { AutomationsInjected } from './face.ts';
import type { createAutomationsStore } from './store.ts';
/** The body's composed props: the tab it draws, its store, its face, and its copy. */
export type AutomationsBodyProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsStore<ReturnType<typeof createAutomationsStore>> & AutomationsInjected & PropsLocale<'automationsPanel'>;
/** The automations panel: everything one tab of this kind draws. */
export declare function AutomationsBody({ useTabInfo, useStore, start, refresh, create, setEnabled, remove, runNow, t, }: AutomationsBodyProps): ReactNode;
//# sourceMappingURL=AutomationsBody.d.ts.map