import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The automations panel's body: the task list with per-row actions and a
 * create form. Everything the panel keeps lives in its store, bucketed by
 * tab; everything it asks for goes through its injected face.
 */
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { IconAlarmClockOutline16, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './AutomationsBody.module.css';
/** Local time, minute precision — the schedule's own resolution. */
function shortTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso;
    return date.toLocaleString();
}
/** One task row: title, cron, schedule facts, and the four gestures. */
function Row({ automation, busy, t, onRunNow, onToggle, onDelete, }) {
    return (_jsxs("li", { className: css.item, "data-automation-id": automation.id, children: [_jsxs("div", { className: css.rowHead, children: [_jsx("span", { className: clsx(css.title, !automation.enabled && css.muted), children: automation.title }), _jsx("button", { type: "button", className: css.gesture, disabled: busy, onClick: onToggle, children: automation.enabled ? t('action.toggleOff') : t('action.toggleOn') }), _jsx("button", { type: "button", className: css.gesture, disabled: busy, onClick: onRunNow, children: t('action.runNow') }), _jsx("button", { type: "button", className: css.gesture, disabled: busy, onClick: onDelete, children: t('action.delete') })] }), _jsxs("div", { className: css.rowBody, children: [_jsx("span", { className: css.cron, children: automation.cron }), !automation.enabled && _jsx("span", { className: css.muted, children: t('row.disabled') }), automation.enabled && automation.nextRunAt !== null && (_jsx("span", { className: css.fact, children: t('row.nextRun', { time: shortTime(automation.nextRunAt) }) })), automation.lastOutcome === 'ok' && _jsx("span", { className: css.ok, children: t('row.lastOk') }), automation.lastOutcome === 'error' && (_jsx("span", { className: css.err, children: t('row.lastError', { message: automation.lastError ?? '' }) }))] }), _jsx("div", { className: clsx(css.rowBody, css.muted), title: automation.workspacePath, children: automation.workspacePath })] }));
}
/** The automations panel: everything one tab of this kind draws. */
export function AutomationsBody({ useTabInfo, useStore, start, refresh, create, setEnabled, remove, runNow, t, }) {
    const { tab } = useTabInfo();
    const { signal } = tab;
    const tabId = tab.id;
    const state = useStore(store => store.byTab[tabId]);
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [cron, setCron] = useState('');
    const [workspace, setWorkspace] = useState('');
    const [prompt, setPrompt] = useState('');
    useEffect(() => {
        if (state !== undefined || signal.aborted)
            return;
        start(tabId, signal);
    }, [state, tabId, signal, start]);
    if (state === undefined) {
        return _jsx("div", { className: css.panel, "data-automations-panel": "loading", children: t('loading') });
    }
    const submitCreate = () => {
        create(tabId, {
            title: title.trim(),
            workspacePath: workspace.trim(),
            prompt: prompt.trim(),
            cron: cron.trim(),
        }, signal);
        setOpen(false);
        setTitle('');
        setCron('');
        setWorkspace('');
        setPrompt('');
    };
    return (_jsxs("div", { className: css.panel, "data-automations-panel": "ready", children: [_jsxs("header", { className: css.header, children: [_jsxs("span", { className: css.headTitle, children: [_jsx(IconAlarmClockOutline16, {}), " ", t('type.label')] }), _jsxs("span", { className: css.headerActions, children: [_jsx("button", { type: "button", className: css.gesture, disabled: state.busy, onClick: () => { setOpen(!open); }, children: t('create.open') }), _jsx("button", { type: "button", className: css.iconAction, disabled: state.busy, "aria-label": t('action.refresh'), title: t('action.refresh'), onClick: () => { refresh(tabId, signal); }, children: _jsx(IconRefreshOutline16, {}) })] })] }), state.notice !== undefined && _jsx("div", { className: css.notice, "data-automations-notice": true, children: state.notice }), open && (_jsxs("section", { className: css.form, "data-automations-form": true, children: [_jsx("div", { className: css.formTitle, children: t('create.title') }), _jsx("input", { className: css.input, placeholder: t('create.namePlaceholder'), value: title, onChange: (event) => { setTitle(event.target.value); }, "data-automations-input": "title" }), _jsx("input", { className: clsx(css.input, css.mono), placeholder: t('create.cronPlaceholder'), value: cron, onChange: (event) => { setCron(event.target.value); }, "data-automations-input": "cron" }), _jsx("input", { className: clsx(css.input, css.mono), placeholder: t('create.workspacePlaceholder'), value: workspace, onChange: (event) => { setWorkspace(event.target.value); }, "data-automations-input": "workspace" }), _jsx("textarea", { className: css.textarea, rows: 3, placeholder: t('create.promptPlaceholder'), value: prompt, onChange: (event) => { setPrompt(event.target.value); }, "data-automations-input": "prompt" }), _jsxs("div", { className: css.formRow, children: [_jsx("button", { type: "button", onClick: () => { setOpen(false); }, children: t('create.cancel') }), _jsx("button", { type: "button", className: css.primary, disabled: state.busy || title.trim() === '' || cron.trim() === '' || workspace.trim() === '' || prompt.trim() === '', onClick: submitCreate, children: t('create.submit') })] })] })), state.list.kind === 'loading' && _jsx("div", { className: css.note, children: t('loading') }), state.list.kind === 'failed' && _jsx("div", { className: css.note, "data-automations-panel": "failed", children: state.list.message }), state.list.kind === 'ready' && state.list.automations.length === 0 && (_jsx("div", { className: css.note, children: t('empty') })), state.list.kind === 'ready' && state.list.automations.length > 0 && (_jsx("ul", { className: css.list, children: state.list.automations.map(automation => (_jsx(Row, { automation: automation, busy: state.busy, t: t, onRunNow: () => { runNow(tabId, automation.id, signal); }, onToggle: () => { setEnabled(tabId, automation.id, !automation.enabled, signal); }, onDelete: () => { remove(tabId, automation.id, signal); } }, automation.id))) }))] }));
}
//# sourceMappingURL=AutomationsBody.js.map