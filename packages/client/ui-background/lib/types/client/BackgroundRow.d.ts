/**
 * BackgroundRow: the General-settings row for the custom background. Shows a
 * preview when one is set, an upload button (photo picker), and a remove
 * button. The applied background is global — closing settings keeps it.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/** Full props of the background settings row. */
export type BackgroundRowProps = PropsRuntime<'settings.general.item'> & PropsLocale<typeof NS>;
/**
 * Render the background settings row.
 * @param props - the runtime share and the locale seat.
 * @returns the row element tree.
 */
export declare function BackgroundRow({ t }: BackgroundRowProps): import("react").JSX.Element;
//# sourceMappingURL=BackgroundRow.d.ts.map