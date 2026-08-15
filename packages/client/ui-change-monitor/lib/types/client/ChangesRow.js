import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ChangesRow: the turn-tail entry under a completed turn. It claims the chain
 * for every completed turn, loads that turn's change set from the Host, and
 * renders nothing when the turn changed no files — so a conversation only
 * ever grows a row the agent actually earned.
 */
import { useEffect, useState } from 'react';
import { ChangesPanel } from "./ChangesPanel.js";
import css from './ChangesRow.module.css';
/**
 * One turn's changes summary line with an expandable panel.
 * @param props - matched turn, locale seat, and the injected controller.
 * @returns the row: a "computing changes" placeholder while the Host
 * settles, the summary line when files changed, or null when the turn
 * changed nothing (or the poll budget ran out).
 */
export function ChangesRow({ matched, controller, t }) {
    const [summary, setSummary] = useState(undefined);
    const [expanded, setExpanded] = useState(false);
    useEffect(() => {
        let cancelled = false;
        setSummary(undefined);
        void controller().summaryFor(matched.turn).then((value) => {
            if (!cancelled)
                setSummary(value);
        });
        return () => { cancelled = true; };
    }, [controller, matched.turn]);
    if (summary === undefined) {
        // The Host may still be settling (big workspaces take minutes); keep a
        // visible placeholder so the row reads as "working", not "missing".
        return (_jsx("div", { className: css.root, "data-changes-row": true, "data-changes-loading": true, children: _jsx("div", { className: css.loading, children: t('history.loading') }) }));
    }
    if (summary === null || summary.files.length === 0) {
        // The settle finished and found nothing: show a quiet confirmation so a
        // turn with no workspace edits reads as "checked, nothing changed"
        // instead of an empty gap that looks like the plugin never fired.
        return (_jsx("div", { className: css.root, "data-changes-row": true, "data-changes-none": true, children: _jsx("div", { className: css.noChanges, children: t('row.noChanges') }) }));
    }
    const filesLabel = summary.files.length === 1
        ? t('summary.files.one')
        : t('summary.files', { count: String(summary.files.length) });
    return (_jsxs("div", { className: css.root, "data-changes-row": true, children: [_jsxs("button", { type: "button", className: css.trigger, onClick: () => { setExpanded(current => !current); }, "aria-expanded": expanded, children: [_jsx("span", { className: css.files, children: filesLabel }), _jsxs("span", { className: css.counts, children: [_jsxs("span", { className: css.addCount, children: ["+", summary.additions] }), _jsxs("span", { className: css.delCount, children: ["\u2212", summary.deletions] })] }), _jsx("span", { className: css.action, children: expanded ? t('row.hide') : t('row.view') })] }), expanded && (_jsx("div", { className: css.panel, children: _jsx(ChangesPanel, { summary: summary, controller: controller(), t: t }) }))] }));
}
//# sourceMappingURL=ChangesRow.js.map