window.__ModuleLoader__.load({
	id: "@dsh-custom/dsh-client-ui-voice-input",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:C:\Users\59639\Desktop\dsh-plugins\packages\client\ui-voice-input\src\client\VoiceInput.module.css.mjs
		const css = ".u1Cdba_trigger{width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;transition:background .15s,color .15s;display:inline-flex}.u1Cdba_trigger:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.u1Cdba_listening{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent);animation:1.2s ease-in-out infinite u1Cdba_voice-pulse}.u1Cdba_listening:hover{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 20%, transparent)}.u1Cdba_icon{width:16px;height:16px}@keyframes u1Cdba_voice-pulse{0%,to{box-shadow:0 0 0 0 color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent)}50%{box-shadow:0 0 0 4px color-mix(in srgb, var(--dsw-alias-state-error-primary) 0%, transparent)}}";
		const tagId = "@dsh-custom/dsh-client-ui-voice-input/VoiceInput.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-custom/dsh-client-ui-voice-input";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var VoiceInput_module_css_default = {
			"listening": "u1Cdba_listening",
			"voice-pulse": "u1Cdba_voice-pulse",
			"trigger": "u1Cdba_trigger",
			"icon": "u1Cdba_icon"
		};
		//#endregion
		//#region src/client/VoiceInput.tsx
		/**
		* VoiceInput: the composer tool-row mic button. Toggles the browser's
		* SpeechRecognition (Web Speech API; Edge/Chrome) and appends each final
		* transcript to the draft through `inputActions.setDraft`, composing with
		* whatever is already typed. Unsupported browsers render nothing;
		* permission/network failures surface through the button's title and a
		* transient `data-error` state instead of a modal.
		*/
		/**
		* Resolve the browser's speech recognition constructor, if any.
		* @returns the constructor, or undefined when the API is absent.
		*/
		function recognitionCtor() {
			const windowRef = globalThis;
			return windowRef.SpeechRecognition ?? windowRef.webkitSpeechRecognition;
		}
		/** Map a Web Speech error event to a stable category. */
		function categoryOf(error) {
			switch (error) {
				case "not-allowed":
				case "service-not-allowed": return "permission";
				case "network": return "network";
				case "no-speech": return "noSpeech";
				case "aborted": return "aborted";
				default: return "network";
			}
		}
		/**
		* Render the composer mic button.
		* @param props - owner zone, the session standard kit (`useInput`,
		* `inputActions`), and the locale seat.
		* @returns the mic button, or null when speech recognition is unsupported.
		*/
		function VoiceInput({ useInput, inputActions, t }) {
			const [listening, setListening] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const engineRef = (0, react.useRef)(null);
			const listeningRef = (0, react.useRef)(false);
			const errorTimer = (0, react.useRef)(void 0);
			const draft = useInput((snapshot) => snapshot.draft);
			const draftRef = (0, react.useRef)(draft);
			(0, react.useEffect)(() => {
				draftRef.current = draft;
			}, [draft]);
			(0, react.useEffect)(() => () => {
				if (errorTimer.current !== void 0) clearTimeout(errorTimer.current);
				engineRef.current?.abort();
			}, []);
			const Ctor = recognitionCtor();
			if (Ctor === void 0) return null;
			const flashError = (category) => {
				setError(category);
				if (errorTimer.current !== void 0) clearTimeout(errorTimer.current);
				errorTimer.current = window.setTimeout(() => {
					setError(null);
				}, 3e3);
			};
			const start = () => {
				const engine = new Ctor();
				engine.lang = navigator.language.startsWith("zh") ? "zh-CN" : "en-US";
				engine.continuous = true;
				engine.interimResults = false;
				listeningRef.current = true;
				setListening(true);
				setError(null);
				engine.onresult = (event) => {
					let transcript = "";
					for (let index = event.resultIndex; index < event.results.length; index += 1) {
						const result = event.results[index];
						if (result !== void 0 && result.isFinal) transcript += result[0]?.transcript ?? "";
					}
					if (transcript === "") return;
					const prefix = draftRef.current;
					const separator = prefix === "" || /[\s，。！？；：、,.!?;:]$/.test(prefix) ? "" : " ";
					inputActions.setDraft(`${prefix}${separator}${transcript}`);
				};
				engine.onerror = (event) => {
					if (event.error === "aborted" && !listeningRef.current) return;
					flashError(categoryOf(event.error));
				};
				engine.onend = () => {
					listeningRef.current = false;
					setListening(false);
				};
				engineRef.current = engine;
				try {
					engine.start();
				} catch {
					flashError("network");
				}
			};
			const stop = () => {
				listeningRef.current = false;
				engineRef.current?.stop();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: `${VoiceInput_module_css_default.trigger} ${listening ? VoiceInput_module_css_default.listening : ""}`,
				"data-voice-input": true,
				"data-listening": listening || void 0,
				"data-error": error ?? void 0,
				"aria-label": listening ? t("trigger.stop") : t("trigger.start"),
				"aria-pressed": listening,
				title: error === null ? listening ? t("trigger.stop") : t("trigger.start") : t(`error.${error}`),
				onClick: () => {
					if (listening) stop();
					else start();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 16 16",
					className: VoiceInput_module_css_default.icon,
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M8 1.5a2.25 2.25 0 0 0-2.25 2.25v4a2.25 2.25 0 0 0 4.5 0v-4A2.25 2.25 0 0 0 8 1.5Zm-3.5 6.25a3.5 3.5 0 0 0 7 0h-1a2.5 2.5 0 0 1-5 0h-1Zm4 4.4V14h2v1H5.5v-1h2v-1.85A4.75 4.75 0 0 1 3.25 7.5h1a3.75 3.75 0 0 0 7.5 0h1a4.75 4.75 0 0 1-4.25 4.65Z",
						fill: "currentColor"
					})
				})
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Dictionary namespace of the voice input button.
		* @module @dsh-custom/dsh-client-ui-voice-input/client
		*/
		const NS = "voiceInput";
		/** English copy. */
		const en = {
			"trigger.start": "Start voice input",
			"trigger.stop": "Stop voice input",
			"error.unsupported": "Voice input is not supported in this browser",
			"error.permission": "Microphone permission was denied",
			"error.network": "Speech recognition failed — check your connection",
			"error.noSpeech": "No speech was detected",
			"error.aborted": "Voice input was interrupted"
		};
		/** Chinese copy. */
		const zh = {
			"trigger.start": "开始语音输入",
			"trigger.stop": "停止语音输入",
			"error.unsupported": "当前浏览器不支持语音输入",
			"error.permission": "麦克风权限被拒绝",
			"error.network": "语音识别失败，请检查网络连接",
			"error.noSpeech": "没有检测到语音",
			"error.aborted": "语音输入被中断"
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services: the slot registry and the locale dictionaries. */
		const inject = ["slots", "locale"];
		/**
		* Client plugin body: register the dictionaries and the composer mic entry.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-voice-input: dictionaries");
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "voice-input",
				order: 5,
				locale: NS
			}, VoiceInput));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map