import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ChangesHistoryAction: the session-header entry into every completed turn's
 * changes. A popover holds two tabs — Turns (per-turn change sets with full
 * diffs) and Session (the cumulative view across retained turns, list only).
 */
import { useEffect, useRef, useState } from 'react';
import { ChangesPanel } from "./ChangesPanel.js";
import css from './ChangesHistoryAction.module.css';
/** HH:MM of a Unix millisecond timestamp. */
function clockTime(at) {
    const date = new Date(at);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}
/**
 * Session-header popover over the turn history and the cumulative view.
 * @param props - session runtime currency, locale, and the injected controller.
 * @returns the trigger and popover, or null when the session has no turns.
 */
export function ChangesHistoryAction({ controller, t }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('turns');
    const [turns, setTurns] = useState(undefined);
    const [expanded, setExpanded] = useState(null);
    const [sessionSummary, setSessionSummary] = useState(undefined);
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const closeOutside = (event) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => { document.removeEventListener('pointerdown', closeOutside); };
    }, [open]);
    // Load the turn list at mount so the control can hide itself for a session
    // with no completed turns; refresh it whenever the popover opens.
    useEffect(() => {
        let cancelled = false;
        void controller().turns().then((value) => {
            if (!cancelled)
                setTurns(value);
        });
        return () => { cancelled = true; };
    }, [controller]);
    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setTurns(undefined);
        setSessionSummary(undefined);
        setExpanded(null);
        void controller().turns().then((value) => {
            if (!cancelled)
                setTurns(value);
        });
        return () => { cancelled = true; };
    }, [open, controller]);
    // The control disappears once the session is known to have no completed
    // turns at all.
    if (turns !== undefined && turns.length === 0)
        return null;
    const expandTurn = (turn) => {
        if (expanded?.turn === turn) {
            setExpanded(null);
            return;
        }
        setExpanded({ turn, summary: undefined });
        void controller().summaryFor(turn).then((summary) => {
            setExpanded(current => current?.turn === turn ? { turn, summary } : current);
        });
    };
    const openSession = () => {
        setTab('session');
        if (sessionSummary === undefined) {
            void controller().session().then(setSessionSummary);
        }
    };
    const onKeyDown = (event) => {
        if (event.key !== 'Escape' || !open)
            return;
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
    };
    return (_jsxs("div", { ref: rootRef, className: css.root, onKeyDown: onKeyDown, children: [_jsx("button", { ref: triggerRef, type: "button", className: css.trigger, "aria-expanded": open, "aria-label": t('history.trigger'), onClick: () => { setOpen(current => !current); }, children: t('history.trigger') }), open && (_jsxs("div", { className: css.popover, "data-changes-history": true, "data-testid": "changes-history", children: [_jsxs("div", { className: css.tabs, role: "tablist", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'turns', className: tab === 'turns' ? `${css.tab} ${css.tabActive}` : css.tab, onClick: () => { setTab('turns'); }, children: t('history.turns') }), _jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'session', className: tab === 'session' ? `${css.tab} ${css.tabActive}` : css.tab, onClick: openSession, children: t('history.session') })] }), _jsxs("div", { className: css.body, children: [tab === 'turns' && (turns === undefined
                                ? _jsx("div", { className: css.hint, children: t('history.loading') })
                                : turns.length === 0
                                    ? _jsx("div", { className: css.hint, children: t('history.empty') })
                                    : (_jsx("ul", { className: css.turnList, children: turns.map(turn => (_jsxs("li", { children: [_jsxs("button", { type: "button", className: `${css.turnRow} ${expanded?.turn === turn.turn ? css.turnRowOpen : ''}`, onClick: () => { expandTurn(turn.turn); }, "aria-expanded": expanded?.turn === turn.turn, children: [_jsx("span", { className: css.turnName, children: t('history.turn', { turn: String(turn.turn) }) }), _jsx("span", { className: css.turnTime, children: clockTime(turn.finishedAt) }), _jsxs("span", { className: css.turnCounts, children: [turn.filesCount === 1
                                                                    ? t('summary.files.one')
                                                                    : t('summary.files', { count: String(turn.filesCount) }), ' ', _jsxs("span", { className: css.addCount, children: ["+", turn.additions] }), _jsxs("span", { className: css.delCount, children: ["\u2212", turn.deletions] })] })] }), expanded?.turn === turn.turn && (_jsx("div", { className: css.turnPanel, children: expanded.summary === undefined
                                                        ? _jsx("div", { className: css.hint, children: t('history.loading') })
                                                        : expanded.summary === null
                                                            ? _jsx("div", { className: css.hint, children: t('history.error') })
                                                            : _jsx(ChangesPanel, { summary: expanded.summary, controller: controller(), t: t }) }))] }, turn.turn))) }))), tab === 'session' && (sessionSummary === undefined
                                ? _jsx("div", { className: css.hint, children: t('history.loading') })
                                : sessionSummary === null
                                    ? _jsx("div", { className: css.hint, children: t('history.empty') })
                                    : _jsx(ChangesPanel, { summary: sessionSummary, controller: controller(), diffable: false, t: t }))] })] }))] }));
}
//# sourceMappingURL=ChangesHistoryAction.js.map