import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Settings page for turn sounds: master switch, volume, and per-slot sound
 * selection (built-in chime or a user-uploaded mp3/wav/ogg ≤1MB).
 *
 * @module @deepseek-ai/dsh-client-ui-turn-sounds/client/SoundSettingsSection
 */
import { useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, } from "./sounds.js";
const MAX_UPLOAD_BYTES = 1024 * 1024;
const ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/ogg,.mp3,.wav,.ogg';
const rowStyle = {
    display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0',
    borderBottom: '1px solid var(--dsw-alias-border-l1, #ccc)',
};
const labelStyle = { fontWeight: 600 };
const controlStyle = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
const selectStyle = { padding: '4px 8px' };
const inputStyle = { flex: 1, minWidth: 200 };
const smallStyle = { fontSize: 12, opacity: 0.7 };
function SoundSlotEditor(props) {
    const { title, choice, onChange } = props;
    const handleFile = (file) => {
        if (file === undefined)
            return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert('音效文件不能超过 1MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== 'string')
                return;
            onChange({ mode: 'custom', customName: file.name, customDataUrl: reader.result });
        };
        reader.readAsDataURL(file);
    };
    return (_jsxs("div", { style: rowStyle, children: [_jsx("div", { style: labelStyle, children: title }), _jsxs("div", { style: controlStyle, children: [_jsxs("select", { style: selectStyle, value: choice.mode, onChange: (event) => {
                            onChange(event.target.value === 'default'
                                ? { mode: 'default' }
                                : { mode: 'custom', ...(choice.customName === undefined ? {} : { customName: choice.customName }), ...(choice.customDataUrl === undefined ? {} : { customDataUrl: choice.customDataUrl }) });
                        }, children: [_jsx("option", { value: "default", children: "\u9ED8\u8BA4\u97F3\u6548" }), _jsx("option", { value: "custom", children: "\u81EA\u5B9A\u4E49\u97F3\u6548" })] }), choice.mode === 'custom' && (_jsxs(_Fragment, { children: [_jsx("input", { type: "file", accept: ACCEPT, style: inputStyle, onChange: (event) => { handleFile(event.target.files?.[0]); } }), choice.customName !== undefined && _jsx("span", { style: smallStyle, children: choice.customName })] }))] })] }));
}
/** The "提示音" settings section. */
export function SoundSettingsSection() {
    const [settings, setSettings] = useState(() => loadSettings());
    const update = (next) => {
        setSettings(next);
        saveSettings(next);
    };
    return (_jsxs("div", { style: { maxWidth: 640 }, children: [_jsx("h3", { style: { margin: '0 0 8px' }, children: "\u63D0\u793A\u97F3" }), _jsx("p", { style: smallStyle, children: "Agent \u5B8C\u6210\u4E00\u8F6E\u56DE\u590D\u65F6\u64AD\u653E\u5B8C\u6210\u97F3\uFF1BAgent \u5411\u4F60\u63D0\u95EE\u65F6\u64AD\u653E\u63D0\u95EE\u97F3\u3002" }), _jsxs("div", { style: rowStyle, children: [_jsxs("label", { style: { ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("input", { type: "checkbox", checked: settings.enabled, onChange: (event) => { update({ ...settings, enabled: event.target.checked }); } }), "\u542F\u7528\u63D0\u793A\u97F3"] }), _jsxs("div", { style: controlStyle, children: [_jsx("span", { children: "\u97F3\u91CF" }), _jsx("input", { type: "range", min: 0, max: 100, value: Math.round(settings.volume * 100), onChange: (event) => { update({ ...settings, volume: Number(event.target.value) / 100 }); } }), _jsxs("span", { children: [Math.round(settings.volume * 100), "%"] })] })] }), _jsx(SoundSlotEditor, { title: "\u5B8C\u6210\u97F3\uFF08Agent \u56DE\u590D\u7ED3\u675F\uFF09", choice: settings.completion, onChange: (completion) => { update({ ...settings, completion }); } }), _jsx(SoundSlotEditor, { title: "\u63D0\u95EE\u97F3\uFF08Agent \u5411\u4F60\u63D0\u95EE\uFF09", choice: settings.question, onChange: (question) => { update({ ...settings, question }); } }), _jsx("button", { type: "button", onClick: () => { update(DEFAULT_SETTINGS); }, style: { marginTop: 12, padding: '6px 12px' }, children: "\u6062\u590D\u9ED8\u8BA4" })] }));
}
//# sourceMappingURL=SoundSettingsSection.js.map