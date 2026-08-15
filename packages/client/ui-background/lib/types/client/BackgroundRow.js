import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BackgroundRow: the General-settings row for the custom background. Shows a
 * preview when one is set, an upload button (photo picker), and a remove
 * button. The applied background is global — closing settings keeps it.
 */
import { useEffect, useRef, useState } from 'react';
import { applyBackground, clearAppliedBackground, clearBackground, encodeImage, loadBackground, saveBackground, } from "./background.js";
import css from './BackgroundRow.module.css';
/**
 * Render the background settings row.
 * @param props - the runtime share and the locale seat.
 * @returns the row element tree.
 */
export function BackgroundRow({ t }) {
    const [image, setImage] = useState(() => loadBackground());
    const [failed, setFailed] = useState(false);
    const fileRef = useRef(null);
    // Keep the persisted background applied across remounts (settings panel
    // open/close). Unmount does NOT clear it: the background is global.
    useEffect(() => {
        const saved = loadBackground();
        if (saved !== null)
            applyBackground(saved);
    }, []);
    const pick = (file) => {
        if (file === undefined)
            return;
        setFailed(false);
        void encodeImage(file).then((url) => {
            saveBackground(url);
            applyBackground(url);
            setImage(url);
        }).catch(() => {
            setFailed(true);
        });
    };
    const remove = () => {
        clearBackground();
        clearAppliedBackground();
        setImage(null);
        setFailed(false);
    };
    return (_jsxs("div", { className: css.group, "data-background-row": true, children: [_jsx("div", { className: css.title, children: t('row.title') }), image !== null && (_jsx("img", { className: css.preview, src: image, alt: t('row.previewAlt'), "data-testid": "background-preview" })), _jsxs("div", { className: css.actions, children: [_jsx("button", { type: "button", className: css.button, onClick: () => { fileRef.current?.click(); }, children: t('row.upload') }), image !== null && (_jsx("button", { type: "button", className: css.button, onClick: remove, children: t('row.remove') }))] }), failed && _jsx("div", { className: css.error, children: t('error.encode') }), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", className: css.fileInput, onChange: (event) => {
                    pick(event.target.files?.[0]);
                    event.target.value = '';
                } })] }));
}
//# sourceMappingURL=BackgroundRow.js.map