/**
 * ChangesHistoryAction: the session-header entry into every completed turn's
 * changes. A popover holds two tabs — Turns (per-turn change sets with full
 * diffs) and Session (the cumulative view across retained turns, list only).
 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ChangeMonitorInjected } from './slots.ts';
import { NS } from './locales.ts';
/** Full props of the history action. */
export type ChangesHistoryActionProps = PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof NS> & InjectFace<ChangeMonitorInjected>;
/**
 * Session-header popover over the turn history and the cumulative view.
 * @param props - session runtime currency, locale, and the injected controller.
 * @returns the trigger and popover, or null when the session has no turns.
 */
export declare function ChangesHistoryAction({ controller, t }: ChangesHistoryActionProps): import("react").JSX.Element | null;
//# sourceMappingURL=ChangesHistoryAction.d.ts.map