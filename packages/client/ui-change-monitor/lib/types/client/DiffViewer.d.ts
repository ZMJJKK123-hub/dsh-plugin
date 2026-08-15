/**
 * DiffViewer: one file's red-green inline diff with folded context. Deleted
 * lines get the error tint, added lines the success tint, context stays
 * neutral; a gutter shows the before/after line numbers exactly like a unified
 * diff. Long unchanged runs — the gap between two hunks, or a long context
 * segment inside one hunk — collapse to a "N lines skipped" marker, keeping
 * only `CONTEXT_KEEP` context lines at each change. Read-only by
 * construction: it renders stored hunks and never touches the workspace.
 */
import type { ChangeHunk, ChangeLine, FileChange } from '@dsh-custom/dsh-change-monitor';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/** Context lines kept around each change when folding long unchanged runs. */
export declare const CONTEXT_KEEP = 5;
/** One rendered diff row: a real line, or a folded "skipped" marker. */
type DiffRow = {
    readonly kind: 'line';
    readonly line: ChangeLine;
} | {
    readonly kind: 'skip';
    readonly count: number;
};
/**
 * Fold one hunk's lines: a run of consecutive context lines longer than
 * `2 * CONTEXT_KEEP` keeps its head and tail and collapses the middle into one
 * skip marker. Changes are never folded.
 * @param hunk - stored hunk.
 * @returns rendered rows in order.
 */
export declare function foldHunk(hunk: ChangeHunk): DiffRow[];
/**
 * Old-side lines skipped between two consecutive hunks (new-side gap when the
 * old side is degenerate, e.g. a file that only grew).
 * @param previous - the hunk that just ended.
 * @param next - the hunk that starts after the gap.
 * @returns skipped line count, or 0 when the hunks are adjacent.
 */
export declare function skippedBetween(previous: ChangeHunk, next: ChangeHunk): number;
/** Build a copyable unified-diff text from the stored hunks. */
export declare function unifiedDiff(file: FileChange): string;
/** One file's full diff: header (status, counts) plus folded hunk rows. */
export declare function DiffViewer({ file, t }: DiffViewerProps): import("react").JSX.Element;
/** Full props of the diff viewer. */
export interface DiffViewerProps extends PropsLocale<typeof NS> {
    /** One stored file change with hunks. */
    file: FileChange;
}
/** Compact byte formatting (B / KB / MB). */
export declare function formatSize(bytes: number): string;
export {};
//# sourceMappingURL=DiffViewer.d.ts.map