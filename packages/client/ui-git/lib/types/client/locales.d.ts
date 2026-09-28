declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Source-control tab name, guide entry, groups, actions, and failure lines. */
        gitPanel: GitPanelKey;
    }
}
/** Simplified Chinese dictionary and key-set source of truth. */
export declare const zh: {
    readonly 'type.label': "源代码";
    readonly 'guide.title': "源代码";
    readonly 'guide.description': "查看这个会话仓库的分支、变更与暂存，提交并推送。";
    readonly loading: "正在读取仓库…";
    readonly notRepo: "当前会话工作区不是 git 仓库。";
    readonly noWorkspace: "请先在左侧选择一个包含 git 仓库的工作区，源代码面板才能显示内容。点击右上角 ← 可收起此栏。";
    readonly empty: "工作区干净，没有变更。";
    readonly 'changes.title': "变更";
    readonly 'staged.title': "已暂存";
    readonly 'status.initial': "尚未有提交";
    readonly 'status.detached': "分离头指针";
    readonly 'status.ahead': "领先 {n}";
    readonly 'status.behind': "落后 {n}";
    readonly 'action.refresh': "刷新";
    readonly 'action.stage': "暂存";
    readonly 'action.stageAll': "全部暂存";
    readonly 'action.unstage': "取消暂存";
    readonly 'action.commit': "提交";
    readonly 'action.generate': "AI 生成";
    readonly 'action.push': "推送";
    readonly 'action.restore': "恢复到此检查点";
    readonly 'commit.placeholder': "提交信息（首行为标题）";
    readonly 'commit.nothing': "没有已暂存的变更可提交。";
    readonly 'diff.loading': "正在加载差异…";
    readonly 'diff.empty': "选择一个文件查看差异。";
    readonly 'diff.failed': "差异加载失败：{message}";
    readonly 'diff.truncated': "差异过长，仅显示末尾部分。";
    readonly 'error.denied': "操作被权限预设阻止：请切换到允许写入的模式后重试。";
    readonly 'error.unavailable': "git 操作失败：{message}";
    readonly 'notice.committed': "已提交 {hash} {subject}";
    readonly 'notice.pushed': "已推送 {branch} 到 {remote}";
    readonly 'notice.restored': "已从检查点恢复工作区";
    readonly 'checkpoints.title': "检查点";
    readonly 'checkpoints.empty': "暂无检查点";
    readonly 'checkpoints.loading': "正在读取检查点…";
};
/** English dictionary. */
export declare const en: {
    readonly 'type.label': "Source Control";
    readonly 'guide.title': "Source Control";
    readonly 'guide.description': "Branch, changes, and staging for this session repository; commit and push.";
    readonly loading: "Reading repository…";
    readonly notRepo: "The session workspace is not a git repository.";
    readonly noWorkspace: "Select a workspace with a git repository from the left sidebar first. Click the ← arrow at the top right to collapse this panel.";
    readonly empty: "Working tree clean.";
    readonly 'changes.title': "Changes";
    readonly 'staged.title': "Staged";
    readonly 'status.initial': "no commits yet";
    readonly 'status.detached': "detached HEAD";
    readonly 'status.ahead': "ahead {n}";
    readonly 'status.behind': "behind {n}";
    readonly 'action.refresh': "Refresh";
    readonly 'action.stage': "Stage";
    readonly 'action.stageAll': "Stage All";
    readonly 'action.unstage': "Unstage";
    readonly 'action.commit': "Commit";
    readonly 'action.generate': "Generate";
    readonly 'action.push': "Push";
    readonly 'action.restore': "Restore to this checkpoint";
    readonly 'commit.placeholder': "Commit message (first line is the subject)";
    readonly 'commit.nothing': "Nothing staged to commit.";
    readonly 'diff.loading': "Loading diff…";
    readonly 'diff.empty': "Select a file to see its diff.";
    readonly 'diff.failed': "Diff failed: {message}";
    readonly 'diff.truncated': "Diff truncated; showing the tail only.";
    readonly 'error.denied': "Blocked by the permission preset: switch to a write-capable mode and retry.";
    readonly 'error.unavailable': "git operation failed: {message}";
    readonly 'notice.committed': "Committed {hash} {subject}";
    readonly 'notice.pushed': "Pushed {branch} to {remote}";
    readonly 'notice.restored': "Work tree restored from the checkpoint";
    readonly 'checkpoints.title': "Checkpoints";
    readonly 'checkpoints.empty': "No checkpoints yet";
    readonly 'checkpoints.loading': "Loading checkpoints…";
};
/** The namespace's key set: zh is the source of truth. */
export type GitPanelKey = keyof typeof zh;
//# sourceMappingURL=locales.d.ts.map