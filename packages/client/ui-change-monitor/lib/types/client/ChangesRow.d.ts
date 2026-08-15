/**
 * ChangesRow: the turn-tail entry under a completed turn. It claims the chain
 * for every completed turn, loads that turn's change set from the Host, and
 * renders nothing when the turn changed no files — so a conversation only
 * ever grows a row the agent actually earned.
 */
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { ChangeMonitorInjected } from './slots.ts';
import { NS } from './locales.ts';
/** Selector match: the turn this tail belongs to. */
export interface ChangesRowMatch {
    readonly turn: number;
}
/** Full props of the turn-tail changes row. */
export type ChangesRowProps = Pick<TurnTailOwnerProps, 'turn'> & {
    matched: ChangesRowMatch;
} & PropsLocale<typeof NS> & InjectFace<ChangeMonitorInjected>;
/**
 * One turn's changes summary line with an expandable panel.
 * @param props - matched turn, locale seat, and the injected controller.
 * @returns the row, or null while loading / when the turn changed nothing.
 */
export declare function ChangesRow({ matched, controller, t }: ChangesRowProps): import("react").JSX.Element | null;
//# sourceMappingURL=ChangesRow.d.ts.map