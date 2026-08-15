window.__ModuleLoader__.load({
	id: "@dsh-custom/dsh-client-ui-background",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/background.ts
		/**
		* Background persistence and application: the uploaded photo is downscaled
		* to a JPEG data URL, stored in localStorage (survives reloads), and applied
		* to the document body. The injected global style (client/index.ts) turns
		* the page-level surfaces transparent when `data-dsh-bg` is present, so the
		* image shows through the main area while the sidebar keeps its own fill.
		*
		* @module @deepseek-ai/dsh-client-ui-background/client
		*/
		/** localStorage key holding the applied background's data URL. */
		const BACKGROUND_STORAGE_KEY = "dsh.background.image";
		/** <style> element id of the injected background rule. */
		const BACKGROUND_STYLE_ID = "dsh-background-style";
		/** Downscale target: images wider than this are shrunk (long side kept). */
		const DEFAULT_MAX_WIDTH = 1920;
		/** JPEG quality for the stored data URL. */
		const DEFAULT_QUALITY = .82;
		/**
		* The currently stored background data URL.
		* @returns the data URL, or null when none is stored.
		*/
		function loadBackground() {
			return localStorage.getItem(BACKGROUND_STORAGE_KEY);
		}
		/** Store a background data URL. @param url - the image data URL to persist. */
		function saveBackground(url) {
			localStorage.setItem(BACKGROUND_STORAGE_KEY, url);
		}
		/** Remove the stored background. */
		function clearBackground() {
			localStorage.removeItem(BACKGROUND_STORAGE_KEY);
		}
		/**
		* Apply a background image to the document body: marks `data-dsh-bg` and
		* publishes the image through the `--dsh-bg-url` custom property, which the
		* injected style consumes.
		* @param url - image data URL (or any URL the browser can paint).
		*/
		function applyBackground(url) {
			document.body.dataset.dshBg = "";
			document.body.style.setProperty("--dsh-bg-url", `url("${url}")`);
		}
		/** Remove the applied background from the body (the stored image stays). */
		function clearAppliedBackground() {
			delete document.body.dataset.dshBg;
			document.body.style.removeProperty("--dsh-bg-url");
		}
		/**
		* Downscale and encode an image file into a JPEG data URL. The image is
		* loaded through an <img>, drawn onto a canvas capped at `maxWidth`, and
		* exported; files already narrower than the cap keep their width. Binary
		* (non-image) files and decode failures reject.
		* @param file - the picked image file.
		* @param maxWidth - long-side cap for the stored image.
		* @param quality - JPEG quality passed to `canvas.toDataURL`.
		* @returns the data URL.
		*/
		async function encodeImage(file, maxWidth = DEFAULT_MAX_WIDTH, quality = DEFAULT_QUALITY) {
			const image = await loadImage(await readAsDataUrl(file));
			const scale = Math.min(1, maxWidth / image.naturalWidth);
			const width = Math.max(1, Math.round(image.naturalWidth * scale));
			const height = Math.max(1, Math.round(image.naturalHeight * scale));
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext("2d");
			if (context === null) throw new Error("background: canvas 2d context unavailable");
			context.drawImage(image, 0, 0, width, height);
			return canvas.toDataURL("image/jpeg", quality);
		}
		/** Read a file as a data URL. */
		function readAsDataUrl(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(/* @__PURE__ */ new Error("background: file read failed"));
				reader.readAsDataURL(file);
			});
		}
		/** Decode an image source into an <img> element (rejects on decode failure). */
		function loadImage(source) {
			return new Promise((resolve, reject) => {
				const image = new Image();
				image.onload = () => resolve(image);
				image.onerror = () => reject(/* @__PURE__ */ new Error("background: image decode failed"));
				image.src = source;
			});
		}
		//#endregion
		//#region \0dsh-css:C:\Users\59639\Desktop\dsh-plugins\packages\client\ui-background\src\client\BackgroundRow.module.css.mjs
		const css = "._3lWV2a_group{flex-direction:column;gap:8px;display:flex}._3lWV2a_title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}._3lWV2a_preview{object-fit:cover;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;width:100%;max-width:320px;max-height:120px}._3lWV2a_actions{gap:8px;display:flex}._3lWV2a_button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:6px;padding:4px 12px;font-size:12.5px}._3lWV2a_button:hover{background:var(--dsw-alias-interactive-bg-hover-accent)}._3lWV2a_error{color:var(--dsw-alias-state-error-primary);font-size:12px}._3lWV2a_fileInput{display:none}";
		const tagId = "@dsh-custom/dsh-client-ui-background/BackgroundRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-custom/dsh-client-ui-background";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var BackgroundRow_module_css_default = {
			"preview": "_3lWV2a_preview",
			"actions": "_3lWV2a_actions",
			"title": "_3lWV2a_title",
			"button": "_3lWV2a_button",
			"error": "_3lWV2a_error",
			"group": "_3lWV2a_group",
			"fileInput": "_3lWV2a_fileInput"
		};
		//#endregion
		//#region src/client/BackgroundRow.tsx
		/**
		* BackgroundRow: the General-settings row for the custom background. Shows a
		* preview when one is set, an upload button (photo picker), and a remove
		* button. The applied background is global — closing settings keeps it.
		*/
		/**
		* Render the background settings row.
		* @param props - the runtime share and the locale seat.
		* @returns the row element tree.
		*/
		function BackgroundRow({ t }) {
			const [image, setImage] = (0, react.useState)(() => loadBackground());
			const [failed, setFailed] = (0, react.useState)(false);
			const fileRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const saved = loadBackground();
				if (saved !== null) applyBackground(saved);
			}, []);
			const pick = (file) => {
				if (file === void 0) return;
				setFailed(false);
				encodeImage(file).then((url) => {
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: BackgroundRow_module_css_default.group,
				"data-background-row": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: BackgroundRow_module_css_default.title,
						children: t("row.title")
					}),
					image !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						className: BackgroundRow_module_css_default.preview,
						src: image,
						alt: t("row.previewAlt"),
						"data-testid": "background-preview"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: BackgroundRow_module_css_default.actions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: BackgroundRow_module_css_default.button,
							onClick: () => {
								fileRef.current?.click();
							},
							children: t("row.upload")
						}), image !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: BackgroundRow_module_css_default.button,
							onClick: remove,
							children: t("row.remove")
						})]
					}),
					failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: BackgroundRow_module_css_default.error,
						children: t("error.encode")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: fileRef,
						type: "file",
						accept: "image/*",
						className: BackgroundRow_module_css_default.fileInput,
						onChange: (event) => {
							pick(event.target.files?.[0]);
							event.target.value = "";
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Background plugin copy: a settings row under General. Product copy is
		* Chinese; the English mirror keeps the key set identical.
		*/
		/** Locale namespace of this plugin. */
		const NS = "background";
		/** 中文产品文案（默认语言）。 */
		const zh = {
			"row.title": "背景图片",
			"row.upload": "上传照片",
			"row.remove": "移除背景",
			"row.previewAlt": "当前背景预览",
			"error.encode": "图片处理失败，请换一张试试"
		};
		/** English mirror. */
		const en = {
			"row.title": "Background image",
			"row.upload": "Upload photo",
			"row.remove": "Remove background",
			"row.previewAlt": "Current background preview",
			"error.encode": "Could not process the image — try another one"
		};
		//#endregion
		//#region src/client/index.ts
		/**
		* Global rule: with `data-dsh-bg` on the body, the page-level surfaces
		* (frame, chat area, details panel) go transparent so the body image shows
		* through, while message bubbles, inputs, and the sidebar keep their own
		* fills. `--dsh-bg-url` is published by {@link applyBackground}.
		*/
		const BACKGROUND_STYLES = `
body[data-dsh-bg] {
  --dsw-alias-bg-base: transparent !important;
  background-image: var(--dsh-bg-url);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}
`;
		/** Required services: the slot registry and the locale dictionaries. */
		const inject = ["slots", "locale"];
		/**
		* Client plugin body: register the dictionaries, the background row, and the
		* global style; restore the persisted background on boot.
		* @param ctx - client root context.
		* @returns disposer removing the style and the applied background.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-background: dictionaries");
			const restore = () => {
				const saved = loadBackground();
				if (saved !== null) applyBackground(saved);
			};
			ctx.effect(() => {
				const style = document.createElement("style");
				style.id = BACKGROUND_STYLE_ID;
				style.textContent = BACKGROUND_STYLES;
				document.head.appendChild(style);
				restore();
				return () => {
					style.remove();
					clearAppliedBackground();
				};
			}, "ui-background: global style");
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "background",
				order: 20,
				locale: NS
			}, BackgroundRow));
			return () => {};
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map