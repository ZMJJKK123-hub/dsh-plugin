window.__ModuleLoader__.load({
	id: "@dsh-custom/dsh-client-ui-turn-sounds",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/sounds.ts
		const STORAGE_KEY = "dsh.turn-sounds";
		/** Default settings: sounds on, 70% volume, built-in chimes. */
		const DEFAULT_SETTINGS = {
			enabled: true,
			volume: .7,
			completion: { mode: "default" },
			question: { mode: "default" }
		};
		function isSoundChoice(value) {
			if (typeof value !== "object" || value === null) return false;
			const choice = value;
			return choice.mode === "default" || choice.mode === "custom";
		}
		function parseSettings(raw) {
			if (raw === null) return DEFAULT_SETTINGS;
			try {
				const value = JSON.parse(raw);
				return {
					enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_SETTINGS.enabled,
					volume: typeof value.volume === "number" && value.volume >= 0 && value.volume <= 1 ? value.volume : DEFAULT_SETTINGS.volume,
					completion: isSoundChoice(value.completion) ? value.completion : DEFAULT_SETTINGS.completion,
					question: isSoundChoice(value.question) ? value.question : DEFAULT_SETTINGS.question
				};
			} catch {
				return DEFAULT_SETTINGS;
			}
		}
		/** Read the persisted sound settings, falling back to defaults. */
		function loadSettings() {
			if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
			return parseSettings(localStorage.getItem(STORAGE_KEY));
		}
		/** Persist sound settings to localStorage. */
		function saveSettings(settings) {
			if (typeof localStorage === "undefined") return;
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			} catch {}
		}
		let audioContext;
		function ensureAudioContext() {
			if (typeof window === "undefined") return void 0;
			const w = window;
			const Ctor = w.AudioContext ?? w.webkitAudioContext;
			if (Ctor === void 0) return void 0;
			if (audioContext === void 0) audioContext = new Ctor();
			if (audioContext.state === "suspended") audioContext.resume();
			return audioContext;
		}
		/** Resume the audio context on the first user gesture (autoplay policy). */
		function primeAudioOnInteraction() {
			if (typeof window === "undefined") return;
			const resume = () => {
				ensureAudioContext()?.resume();
				window.removeEventListener("pointerdown", resume);
				window.removeEventListener("keydown", resume);
			};
			window.addEventListener("pointerdown", resume);
			window.addEventListener("keydown", resume);
		}
		function playTone(context, frequency, startAt, duration, volume) {
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			oscillator.type = "sine";
			oscillator.frequency.value = frequency;
			gain.gain.setValueAtTime(1e-4, startAt);
			gain.gain.exponentialRampToValueAtTime(volume, startAt + .01);
			gain.gain.exponentialRampToValueAtTime(1e-4, startAt + duration);
			oscillator.connect(gain);
			gain.connect(context.destination);
			oscillator.start(startAt);
			oscillator.stop(startAt + duration + .02);
		}
		function playDefault(kind, volume) {
			const context = ensureAudioContext();
			if (context === void 0) return;
			const now = context.currentTime + .01;
			if (kind === "completion") {
				playTone(context, 660, now, .18, volume);
				playTone(context, 880, now + .15, .22, volume);
			} else {
				playTone(context, 520, now, .18, volume);
				playTone(context, 390, now + .15, .24, volume);
			}
		}
		function playCustom(dataUrl, volume) {
			const audio = new Audio(dataUrl);
			audio.volume = Math.max(0, Math.min(1, volume));
			audio.play().catch(() => void 0);
		}
		/** Play the configured sound for one event kind. */
		function playSound(kind, settings) {
			if (!settings.enabled || settings.volume <= 0) return;
			const choice = kind === "completion" ? settings.completion : settings.question;
			if (choice.mode === "custom" && choice.customDataUrl !== void 0) playCustom(choice.customDataUrl, settings.volume);
			else playDefault(kind, settings.volume);
		}
		//#endregion
		//#region src/client/SoundSettingsSection.tsx
		/**
		* Settings page for turn sounds: master switch, volume, and per-slot sound
		* selection (built-in chime or a user-uploaded mp3/wav/ogg ≤1MB).
		*
		* @module @deepseek-ai/dsh-client-ui-turn-sounds/client/SoundSettingsSection
		*/
		const MAX_UPLOAD_BYTES = 1024 * 1024;
		const ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/ogg,.mp3,.wav,.ogg";
		const rowStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 8,
			padding: "12px 0",
			borderBottom: "1px solid var(--dsw-alias-border-l1, #ccc)"
		};
		const labelStyle = { fontWeight: 600 };
		const controlStyle = {
			display: "flex",
			gap: 8,
			alignItems: "center",
			flexWrap: "wrap"
		};
		const selectStyle = { padding: "4px 8px" };
		const inputStyle = {
			flex: 1,
			minWidth: 200
		};
		const smallStyle = {
			fontSize: 12,
			opacity: .7
		};
		function SoundSlotEditor(props) {
			const { title, choice, onChange } = props;
			const handleFile = (file) => {
				if (file === void 0) return;
				if (file.size > MAX_UPLOAD_BYTES) {
					alert("音效文件不能超过 1MB");
					return;
				}
				const reader = new FileReader();
				reader.onload = () => {
					if (typeof reader.result !== "string") return;
					onChange({
						mode: "custom",
						customName: file.name,
						customDataUrl: reader.result
					});
				};
				reader.readAsDataURL(file);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rowStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: labelStyle,
					children: title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: controlStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						style: selectStyle,
						value: choice.mode,
						onChange: (event) => {
							onChange(event.target.value === "default" ? { mode: "default" } : {
								mode: "custom",
								...choice.customName === void 0 ? {} : { customName: choice.customName },
								...choice.customDataUrl === void 0 ? {} : { customDataUrl: choice.customDataUrl }
							});
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "default",
							children: "默认音效"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "custom",
							children: "自定义音效"
						})]
					}), choice.mode === "custom" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "file",
						accept: ACCEPT,
						style: inputStyle,
						onChange: (event) => {
							handleFile(event.target.files?.[0]);
						}
					}), choice.customName !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: smallStyle,
						children: choice.customName
					})] })]
				})]
			});
		}
		/** The "提示音" settings section. */
		function SoundSettingsSection() {
			const [settings, setSettings] = (0, react.useState)(() => loadSettings());
			const update = (next) => {
				setSettings(next);
				saveSettings(next);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: { maxWidth: 640 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: { margin: "0 0 8px" },
						children: "提示音"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: smallStyle,
						children: "Agent 完成一轮回复时播放完成音；Agent 向你提问时播放提问音。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: rowStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: {
								...labelStyle,
								display: "flex",
								alignItems: "center",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: settings.enabled,
								onChange: (event) => {
									update({
										...settings,
										enabled: event.target.checked
									});
								}
							}), "启用提示音"]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: controlStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "音量" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "range",
									min: 0,
									max: 100,
									value: Math.round(settings.volume * 100),
									onChange: (event) => {
										update({
											...settings,
											volume: Number(event.target.value) / 100
										});
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [Math.round(settings.volume * 100), "%"] })
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SoundSlotEditor, {
						title: "完成音（Agent 回复结束）",
						choice: settings.completion,
						onChange: (completion) => {
							update({
								...settings,
								completion
							});
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SoundSlotEditor, {
						title: "提问音（Agent 向你提问）",
						choice: settings.question,
						onChange: (question) => {
							update({
								...settings,
								question
							});
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							update(DEFAULT_SETTINGS);
						},
						style: {
							marginTop: 12,
							padding: "6px 12px"
						},
						children: "恢复默认"
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Services required by the browser plugin. */
		const inject = ["slots", "sessions"];
		/**
		* Register the settings page and the session-event sound listener.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			primeAudioOnInteraction();
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "sounds",
				order: 30,
				label: () => "提示音"
			}, SoundSettingsSection));
			const knownTurns = /* @__PURE__ */ new Map();
			const knownQuestions = /* @__PURE__ */ new Map();
			const seeded = /* @__PURE__ */ new Set();
			const unsubscribers = /* @__PURE__ */ new Map();
			const handleSnapshot = (sessionId, snapshot) => {
				const settings = loadSettings();
				const turns = knownTurns.get(sessionId) ?? /* @__PURE__ */ new Set();
				const questions = knownQuestions.get(sessionId) ?? /* @__PURE__ */ new Set();
				if (!seeded.has(sessionId)) {
					for (const turn of snapshot.turnEnds.keys()) turns.add(turn);
					for (const pending of snapshot.pending) if (pending.kind === "question") questions.add(pending.key);
					seeded.add(sessionId);
				} else {
					for (const turn of snapshot.turnEnds.keys()) if (!turns.has(turn)) {
						turns.add(turn);
						playSound("completion", settings);
					}
					for (const pending of snapshot.pending) if (pending.kind === "question" && !questions.has(pending.key)) {
						questions.add(pending.key);
						playSound("question", settings);
					}
				}
				knownTurns.set(sessionId, turns);
				knownQuestions.set(sessionId, questions);
			};
			const attachSession = (sessionId) => {
				if (unsubscribers.has(sessionId)) return;
				const binding = ctx.sessions.binding(sessionId);
				if (binding === void 0) return;
				const session = binding.session;
				const unsubscribe = session.subscribe(() => {
					handleSnapshot(sessionId, session.getSnapshot());
				});
				unsubscribers.set(sessionId, unsubscribe);
				handleSnapshot(sessionId, session.getSnapshot());
			};
			const syncSessions = () => {
				const ids = new Set(ctx.sessions.list.getSnapshot().ids);
				for (const [sessionId, unsubscribe] of unsubscribers) if (!ids.has(sessionId)) {
					unsubscribe();
					unsubscribers.delete(sessionId);
					seeded.delete(sessionId);
					knownTurns.delete(sessionId);
					knownQuestions.delete(sessionId);
				}
				for (const sessionId of ids) attachSession(sessionId);
			};
			const unsubscribeList = ctx.sessions.list.subscribe(syncSessions);
			syncSessions();
			ctx.effect(() => () => {
				unsubscribeList();
				for (const unsubscribe of unsubscribers.values()) unsubscribe();
				unsubscribers.clear();
			}, "ui-turn-sounds: session listener");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map