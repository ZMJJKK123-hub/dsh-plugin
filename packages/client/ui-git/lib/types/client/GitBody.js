import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The source-control panel's body: branch header, change groups, diff, and
 * the commit/push actions. Everything the panel keeps lives in its store,
 * bucketed by tab; everything it asks for goes through its injected face.
 * The component itself only decides what to draw and what a click means.
 */
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { IconBranchOutline16, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './GitBody.module.css';
/** The notice strings every mutating action shares. */
function labelsOf(t) {
    return {
        committed: (hash, subject) => t('notice.committed', { hash, subject }),
        pushed: (remote, branch) => t('notice.pushed', { remote, branch }),
        restored: () => t('notice.restored'),
        denied: t('error.denied'),
        failed: message => t('error.unavailable', { message }),
    };
}
/** Split one status view into the panel's two groups. */
function groupsOf(view) {
    const changes = [];
    const staged = [];
    for (const entry of view.entries) {
        if (entry.staged)
            staged.push(entry);
        if (entry.unstaged || entry.untracked)
            changes.push(entry);
    }
    return { changes, staged };
}
/** One branch line: name or detached marker, plus ahead/behind counts. */
function branchLine(view, t) {
    const name = view.detached
        ? t('status.detached')
        : (view.branch ?? '');
    const counts = [
        view.ahead > 0 ? t('status.ahead', { n: String(view.ahead) }) : '',
        view.behind > 0 ? t('status.behind', { n: String(view.behind) }) : '',
    ].filter(part => part !== '');
    const tail = [view.initial ? t('status.initial') : '', ...counts].filter(part => part !== '').join(', ');
    return tail === '' ? name : `${name} · ${tail}`;
}
/** One change row: status letter, path, and the group's gesture button. */
function EntryRow({ entry, staged, selected, busy, t, onSelect, onGesture, }) {
    return (_jsxs("li", { className: clsx(css.item, selected && css.selected), "data-git-path": entry.path, "data-git-staged": staged, children: [_jsxs("button", { type: "button", className: css.row, title: entry.path, onClick: onSelect, children: [_jsx("span", { className: css.code, children: entry.code.trim() === '' ? '·' : entry.code.trim() }), _jsx("span", { className: css.name, children: entry.path })] }), _jsx("button", { type: "button", className: css.gesture, disabled: busy, "aria-label": staged ? t('action.unstage') : t('action.stage'), title: staged ? t('action.unstage') : t('action.stage'), onClick: onGesture, children: staged ? '−' : '+' })] }));
}
/** The source-control panel: everything one tab of this kind draws. */
export function GitBody({ useTabInfo, useStore, start, refresh, openDiff, stage, stageAll, unstage, commit, push, generateMessage, loadCheckpoints, restoreCheckpoint, t, }) {
    const { tab } = useTabInfo();
    const { signal } = tab;
    const tabId = tab.id;
    const state = useStore(store => store.byTab[tabId]);
    const [message, setMessage] = useState('');
    useEffect(() => {
        // A bucket gone because the record aborted must not be re-seeded by a
        // component that has not unmounted yet.
        if (state !== undefined || signal.aborted)
            return;
        start(tabId, signal);
        loadCheckpoints(tabId, signal);
    }, [state, tabId, signal, start, loadCheckpoints]);
    // The bucket appears with `start`; until then the panel is a loading line.
    if (state === undefined) {
        return _jsx("div", { className: css.panel, "data-git-panel": "loading", children: t('loading') });
    }
    // The panel is per-session; without a git workspace there is nothing to
    // show — guide the user instead of leaving a blank panel.
    if (state.status.kind === 'failed' && state.status.message.includes('not a git repository')) {
        return (_jsxs("div", { className: css.panel, "data-git-panel": "no-workspace", children: [_jsx("header", { className: css.header, children: _jsxs("span", { className: css.headTitle, children: [_jsx(IconBranchOutline16, {}), " ", t('type.label')] }) }), _jsx("div", { className: css.note, children: t('noWorkspace') })] }));
    }
    // A fresh draft lands in the commit box once; typing afterwards is the user's.
    useEffect(() => {
        if (state?.generated !== undefined)
            setMessage(state.generated);
    }, [state?.generated]);
    const labels = labelsOf(t);
    const status = state.status;
    let header;
    let body;
    if (status.kind === 'ready') {
        const { changes, staged } = groupsOf(status.view);
        const clean = changes.length === 0 && staged.length === 0;
        header = (_jsxs("div", { className: css.branch, children: [_jsx(IconBranchOutline16, { className: css.branchIcon }), _jsx("span", { className: css.branchName, children: branchLine(status.view, t) }), _jsx("span", { className: css.upstream, children: status.view.upstream ?? '' })] }));
        body = clean
            ? _jsx("div", { className: css.note, "data-git-panel": "clean", children: t('empty') })
            : (_jsxs(_Fragment, { children: [changes.length > 0 && (_jsxs("section", { className: css.group, "data-git-group": "changes", children: [_jsxs("header", { className: css.groupHeader, children: [_jsxs("span", { children: [t('changes.title'), " (", changes.length, ")"] }), _jsx("button", { type: "button", className: css.groupAction, disabled: state.busy, onClick: () => { stageAll(tabId, signal); }, children: t('action.stageAll') })] }), _jsx("ul", { className: css.list, children: changes.map(entry => (_jsx(EntryRow, { entry: entry, staged: false, busy: state.busy, t: t, selected: state.selected === entry.path && !state.selectedStaged, onSelect: () => { openDiff(tabId, entry.path, false, signal); }, onGesture: () => { stage(tabId, entry.path, signal); } }, `c:${entry.path}`))) })] })), staged.length > 0 && (_jsxs("section", { className: css.group, "data-git-group": "staged", children: [_jsx("header", { className: css.groupHeader, children: _jsxs("span", { children: [t('staged.title'), " (", staged.length, ")"] }) }), _jsx("ul", { className: css.list, children: staged.map(entry => (_jsx(EntryRow, { entry: entry, staged: true, busy: state.busy, t: t, selected: state.selected === entry.path && state.selectedStaged, onSelect: () => { openDiff(tabId, entry.path, true, signal); }, onGesture: () => { unstage(tabId, entry.path, signal); } }, `s:${entry.path}`))) })] })), _jsxs("section", { className: css.commitArea, children: [_jsx("textarea", { className: css.commitInput, rows: 2, value: message, placeholder: t('commit.placeholder'), onChange: (event) => { setMessage(event.target.value); }, "data-git-input": "message" }), _jsxs("div", { className: css.commitRow, children: [_jsx("button", { type: "button", disabled: state.busy || state.generating || staged.length === 0, onClick: () => { generateMessage(tabId, labels, signal); }, children: state.generating ? t('loading') : t('action.generate') }), _jsx("button", { type: "button", className: css.primary, disabled: state.busy || staged.length === 0 || message.trim() === '', onClick: () => {
                                            commit(tabId, message.trim(), labels, signal);
                                            setMessage('');
                                        }, children: t('action.commit') })] }), staged.length === 0 && _jsx("div", { className: css.hint, children: t('commit.nothing') })] })] }));
    }
    else if (status.kind === 'failed') {
        header = null;
        body = (_jsx("div", { className: css.note, "data-git-panel": status.denied ? 'denied' : 'failed', children: status.denied ? t('error.denied') : status.message }));
    }
    else {
        header = null;
        body = _jsx("div", { className: css.note, "data-git-panel": "loading", children: t('loading') });
    }
    return (_jsxs("div", { className: css.panel, "data-git-panel": "ready", children: [_jsxs("header", { className: css.header, children: [header, _jsxs("span", { className: css.headerActions, children: [_jsx("button", { type: "button", className: css.iconAction, disabled: state.busy, "aria-label": t('action.refresh'), title: t('action.refresh'), onClick: () => { refresh(tabId, signal); }, children: _jsx(IconRefreshOutline16, {}) }), _jsx("button", { type: "button", className: css.iconAction, disabled: state.busy, onClick: () => { push(tabId, labels, signal); }, children: t('action.push') })] })] }), state.notice !== undefined && _jsx("div", { className: css.notice, "data-git-notice": true, children: state.notice }), body, state.status.kind === 'ready' && (_jsxs("section", { className: css.group, "data-git-group": "checkpoints", children: [_jsx("header", { className: css.groupHeader, children: _jsx("span", { children: t('checkpoints.title') }) }), state.checkpoints.kind === 'loading' && _jsx("div", { className: css.note, children: t('checkpoints.loading') }), state.checkpoints.kind === 'ready' && state.checkpoints.checkpoints.length === 0 && (_jsx("div", { className: css.note, children: t('checkpoints.empty') })), state.checkpoints.kind === 'ready' && state.checkpoints.checkpoints.length > 0 && (_jsx("ul", { className: css.list, children: state.checkpoints.checkpoints.map(checkpoint => (_jsxs("li", { className: css.item, "data-git-checkpoint": checkpoint.index, children: [_jsxs("span", { className: css.row, title: checkpoint.label, children: [_jsx("span", { className: css.code, children: checkpoint.shortHash.slice(0, 7) }), _jsx("span", { className: css.name, children: checkpoint.label })] }), _jsx("button", { type: "button", className: css.gesture, disabled: state.busy, "aria-label": t('action.restore'), title: t('action.restore'), onClick: () => { restoreCheckpoint(tabId, checkpoint.index, labels, signal); }, children: '↺' })] }, checkpoint.index))) }))] })), _jsxs("section", { className: css.diffArea, "data-git-diff": state.diff.kind, children: [state.diff.kind === 'idle' && _jsx("div", { className: css.note, children: t('diff.empty') }), state.diff.kind === 'loading' && _jsx("div", { className: css.note, children: t('diff.loading') }), state.diff.kind === 'failed' && _jsx("div", { className: css.note, children: t('diff.failed', { message: state.diff.message }) }), state.diff.kind === 'ready' && (_jsxs(_Fragment, { children: [state.diff.truncated && _jsx("div", { className: css.hint, children: t('diff.truncated') }), _jsx("pre", { className: css.patch, children: state.diff.patch })] }))] })] }));
}
//# sourceMappingURL=GitBody.js.map