import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ChangesPanel: one change set's file list with per-file counts, plus an
 * inline DiffViewer for the selected file. Loading and failure states stay
 * quiet — a missing record renders nothing.
 */
import { useState } from 'react';
import { DiffViewer } from "./DiffViewer.js";
import css from './ChangesPanel.module.css';
/**
 * File list plus inline diff. Clicking a row loads that file's hunks once and
 * keeps the viewer mounted while the row stays selected.
 */
export function ChangesPanel({ summary, controller, diffable = true, t }) {
    const [selected, setSelected] = useState(null);
    const [file, setFile] = useState(undefined);
    const select = (path) => {
        if (!diffable)
            return;
        if (selected === path) {
            setSelected(null);
            return;
        }
        setSelected(path);
        setFile(undefined);
        void controller.fileFor(summary.turn, path).then(setFile);
    };
    return (_jsx("div", { className: css.root, "data-changes-panel": true, children: _jsx("ul", { className: css.list, children: summary.files.map(fileSummary => (_jsxs("li", { children: [_jsxs("button", { type: "button", className: `${css.row} ${selected === fileSummary.path ? css.rowSelected : ''}`, onClick: () => { select(fileSummary.path); }, "aria-expanded": selected === fileSummary.path, children: [_jsx("span", { className: `${css.status} ${css[fileSummary.status]}`, children: statusLetter(fileSummary.status) }), _jsx("span", { className: css.path, children: fileSummary.path }), _jsxs("span", { className: css.counts, children: [_jsxs("span", { className: css.addCount, children: ["+", fileSummary.additions] }), _jsxs("span", { className: css.delCount, children: ["\u2212", fileSummary.deletions] })] })] }), selected === fileSummary.path && diffable && (_jsx("div", { className: css.diff, children: file === undefined
                            ? _jsx("div", { className: css.loading, children: t('history.loading') })
                            : file === null
                                ? null
                                : _jsx(DiffViewer, { file: file, t: t }) }))] }, fileSummary.path))) }) }));
}
/** One-letter status for the file list. */
export function statusLetter(status) {
    return status === 'modified' ? 'M' : status === 'added' ? 'A' : 'D';
}
//# sourceMappingURL=ChangesPanel.js.map