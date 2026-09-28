declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Automations tab name, guide entry, rows, actions, and failure lines. */
        automationsPanel: AutomationsPanelKey;
    }
}
/** Simplified Chinese dictionary and key-set source of truth. */
export declare const zh: {
    readonly 'type.label': "定时任务";
    readonly 'guide.title': "定时任务";
    readonly 'guide.description': "按 cron 计划在各工作区自动新建会话并执行 prompt。";
    readonly loading: "正在读取定时任务…";
    readonly empty: "还没有定时任务。";
    readonly 'create.title': "新建定时任务";
    readonly 'create.open': "新建";
    readonly 'create.submit': "创建";
    readonly 'create.cancel': "取消";
    readonly 'create.namePlaceholder': "任务名称";
    readonly 'create.cronPlaceholder': "cron 表达式（分 时 日 月 周）";
    readonly 'create.workspacePlaceholder': "工作区绝对路径";
    readonly 'create.promptPlaceholder': "每次运行的 prompt";
    readonly 'row.nextRun': "下次 {time}";
    readonly 'row.lastOk': "上次成功";
    readonly 'row.lastError': "上次失败：{message}";
    readonly 'row.disabled': "已停用";
    readonly 'action.runNow': "立即运行";
    readonly 'action.toggleOn': "启用";
    readonly 'action.toggleOff': "停用";
    readonly 'action.delete': "删除";
    readonly 'action.refresh': "刷新";
    readonly 'error.unavailable': "操作失败：{message}";
};
/** English dictionary. */
export declare const en: {
    readonly 'type.label': "Automations";
    readonly 'guide.title': "Automations";
    readonly 'guide.description': "Schedule cron-driven sessions with your prompt in any workspace.";
    readonly loading: "Loading automations…";
    readonly empty: "No automations yet.";
    readonly 'create.title': "New automation";
    readonly 'create.open': "New";
    readonly 'create.submit': "Create";
    readonly 'create.cancel': "Cancel";
    readonly 'create.namePlaceholder': "Task title";
    readonly 'create.cronPlaceholder': "cron expression (minute hour dom month dow)";
    readonly 'create.workspacePlaceholder': "Absolute workspace path";
    readonly 'create.promptPlaceholder': "Prompt for every run";
    readonly 'row.nextRun': "next {time}";
    readonly 'row.lastOk': "last run ok";
    readonly 'row.lastError': "last failed: {message}";
    readonly 'row.disabled': "disabled";
    readonly 'action.runNow': "Run now";
    readonly 'action.toggleOn': "Enable";
    readonly 'action.toggleOff': "Disable";
    readonly 'action.delete': "Delete";
    readonly 'action.refresh': "Refresh";
    readonly 'error.unavailable': "operation failed: {message}";
};
/** The namespace's key set: zh is the source of truth. */
export type AutomationsPanelKey = keyof typeof zh;
//# sourceMappingURL=locales.d.ts.map