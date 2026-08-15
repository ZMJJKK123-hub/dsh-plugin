/**
 * ChangesPanel: one change set's file list with per-file counts, plus an
 * inline DiffViewer for the selected file. Loading and failure states stay
 * quiet — a missing record renders nothing.
 */
import type { ChangeSetSummary, FileChangeSummary } from '@dsh-custom/dsh-change-monitor';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ChangeMonitorController } from './controller.ts';
import { NS } from './locales.ts';
/** Full props of the change-set panel. */
export interface ChangesPanelProps extends PropsLocale<typeof NS> {
    /** The change set to render. */
    summary: ChangeSetSummary;
    /** Controller that can fetch per-file diffs. */
    controller: ChangeMonitorController;
    /** Whether per-file diffs are available (false for the merged session view). */
    diffable?: boolean;
}
/**
 * File list plus inline diff. Clicking a row loads that file's hunks once and
 * keeps the viewer mounted while the row stays selected.
 */
export declare function ChangesPanel({ summary, controller, diffable, t }: ChangesPanelProps): import("react").JSX.Element;
/** One-letter status for the file list. */
export declare function statusLetter(status: FileChangeSummary['status']): string;
//# sourceMappingURL=ChangesPanel.d.ts.map