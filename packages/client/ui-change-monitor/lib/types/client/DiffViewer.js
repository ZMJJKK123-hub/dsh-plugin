import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * DiffViewer: one file's red-green inline diff with folded context. Deleted
 * lines get the error tint, added lines the success tint, context stays
 * neutral; a gutter shows the before/after line numbers exactly like a unified
 * diff. Long unchanged runs — the gap between two hunks, or a long context
 * segment inside one hunk — collapse to a "N lines skipped" marker, keeping
 * only `CONTEXT_KEEP` context lines at each change. Read-only by
 * construction: it renders stored hunks and never touches the workspace.
 */
import { useMemo, useState } from 'react';
import css from './DiffViewer.module.css';
/** Context lines kept around each change when folding long unchanged runs. */
export const CONTEXT_KEEP = 5;
/**
 * Fold one hunk's lines: a run of consecutive context lines longer than
 * `2 * CONTEXT_KEEP` keeps its head and tail and collapses the middle into one
 * skip marker. Changes are never folded.
 * @param hunk - stored hunk.
 * @returns rendered rows in order.
 */
export function foldHunk(hunk) {
    const rows = [];
    let contextRun = [];
    const flush = () => {
        if (contextRun.length === 0)
            return;
        if (contextRun.length <= CONTEXT_KEEP * 2) {
            for (const line of contextRun)
                rows.push({ kind: 'line', line });
        }
        else {
            for (const line of contextRun.slice(0, CONTEXT_KEEP))
                rows.push({ kind: 'line', line });
            rows.push({ kind: 'skip', count: contextRun.length - CONTEXT_KEEP * 2 });
            for (const line of contextRun.slice(-CONTEXT_KEEP))
                rows.push({ kind: 'line', line });
        }
        contextRun = [];
    };
    for (const line of hunk.lines) {
        if (line.kind === 'context') {
            contextRun.push(line);
        }
        else {
            flush();
            rows.push({ kind: 'line', line });
        }
    }
    flush();
    return rows;
}
/**
 * Old-side lines skipped between two consecutive hunks (new-side gap when the
 * old side is degenerate, e.g. a file that only grew).
 * @param previous - the hunk that just ended.
 * @param next - the hunk that starts after the gap.
 * @returns skipped line count, or 0 when the hunks are adjacent.
 */
export function skippedBetween(previous, next) {
    const oldGap = next.oldStart - (previous.oldStart + previous.oldLines);
    const newGap = next.newStart - (previous.newStart + previous.newLines);
    return Math.max(0, oldGap, newGap);
}
/** Build a copyable unified-diff text from the stored hunks. */
export function unifiedDiff(file) {
    const lines = [];
    for (const hunk of file.hunks) {
        const oldRange = hunk.oldLines === 1 ? String(hunk.oldStart) : `${hunk.oldStart},${hunk.oldLines}`;
        const newRange = hunk.newLines === 1 ? String(hunk.newStart) : `${hunk.newStart},${hunk.newLines}`;
        lines.push(`@@ -${oldRange} +${newRange} @@`);
        for (const line of hunk.lines) {
            const sign = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' ';
            lines.push(`${sign}${line.text}`);
        }
    }
    return lines.join('\n');
}
/** One file's full diff: header (status, counts) plus folded hunk rows. */
export function DiffViewer({ file, t }) {
    const [copied, setCopied] = useState(false);
    const text = useMemo(() => unifiedDiff(file), [file]);
    const handleCopySuccess = () => {
        setCopied(true);
        setTimeout(() => { setCopied(false); }, 1200);
    };
    const handleCopyFailure = () => {
        setCopied(false);
    };
    const copy = () => {
        void navigator.clipboard.writeText(text).then(handleCopySuccess, handleCopyFailure);
    };
    const summary = file.summary ?? t('binary.summary');
    return (_jsxs("div", { className: css.root, children: [_jsxs("div", { className: css.header, children: [_jsx("span", { className: `${css.status} ${css[file.status]}`, children: statusLetter(file.status) }), _jsx("span", { className: css.path, children: file.path }), _jsxs("span", { className: css.counts, children: [_jsxs("span", { className: css.addCount, children: ["+", file.additions] }), _jsxs("span", { className: css.delCount, children: ["\u2212", file.deletions] })] }), _jsx("button", { type: "button", className: css.copy, onClick: copy, children: copied ? t('diff.copied') : t('diff.copy') })] }), file.hunks.length === 0
                ? (_jsxs("div", { className: css.binary, "data-changes-binary": true, children: [_jsx("span", { className: css.binaryLabel, children: summary }), _jsxs("span", { className: css.binarySizes, children: [formatSize(file.beforeSize), " \u2192 ", formatSize(file.afterSize)] })] }))
                : (_jsx("div", { className: css.body, "data-changes-diff": true, children: file.hunks.map((hunk, index) => {
                        const gap = index === 0 ? 0 : skippedBetween(file.hunks[index - 1], hunk);
                        return (_jsxs("div", { children: [gap > 0 && _jsx(SkipRow, { count: gap, t: t }), foldHunk(hunk).map((row, rowIndex) => row.kind === 'skip'
                                    ? _jsx(SkipRow, { count: row.count, t: t }, `s${rowIndex}`)
                                    : _jsx(LineRow, { line: row.line }, `l${rowIndex}`))] }, index));
                    }) }))] }));
}
/** One folded "N lines skipped" marker row. */
function SkipRow({ count, t }) {
    return (_jsx("div", { className: css.skipped, "data-changes-skipped": true, children: t('diff.skipped', { count: String(count) }) }));
}
/** One diff line row: gutter numbers, sign, text, and the kind tint. */
function LineRow({ line }) {
    // Explicit property lookups, never a dynamic `css[`line${kind}`]` key: the
    // production bundle keeps the CSS module keys in their source casing, so a
    // template key would resolve undefined and silently drop the tint.
    const kindClass = line.kind === 'add'
        ? css.lineAdd
        : line.kind === 'del'
            ? css.lineDel
            : css.lineContext;
    return (_jsxs("div", { className: `${css.line} ${kindClass}`, "data-kind": line.kind, children: [_jsx("span", { className: css.oldNo, children: line.oldLine ?? '' }), _jsx("span", { className: css.newNo, children: line.newLine ?? '' }), _jsx("span", { className: css.sign, children: line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : '' }), _jsx("span", { className: css.text, children: line.text || ' ' })] }));
}
/** One-letter status, matching the changes-panel vocabulary. */
function statusLetter(status) {
    return status === 'modified' ? 'M' : status === 'added' ? 'A' : 'D';
}
/** Compact byte formatting (B / KB / MB). */
export function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//# sourceMappingURL=DiffViewer.js.map