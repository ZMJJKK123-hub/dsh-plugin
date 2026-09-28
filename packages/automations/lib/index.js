import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { dshHomePath } from "@deepseek-ai/dsh-home-paths";
import { setInterval } from "node:timers";
import { brandString } from "@deepseek-ai/dsh-brand";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
//#region lib/types/cron.js
/**
* A pure five-field cron expression parser and matcher (Vixie semantics):
* minute hour day-of-month month day-of-week, numbers only, with the star
* form, ranges a-b, steps (star-slash-n and a-b-slash-n), and comma lists.
* The day rule is the classic one: when both day fields are restricted,
* either may match (OR); otherwise only the restricted field filters. All
* comparisons are in the host's local time — these are machine-level tasks.
*
* @module @dsh-custom/dsh-automations
*/
/** One invalid expression. */
var CronError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "CronError";
	}
};
/** Upper bounds indexed by field position. */
const FIELD_BOUNDS = [
	59,
	23,
	31,
	12,
	6
];
/** The lower bound that pairs with each field's upper bound. */
const FIELD_MINIMUMS = [
	0,
	0,
	1,
	1,
	0
];
/** One field's bound, never undefined for the five legal positions. */
function bound(position, bounds) {
	const value = bounds[position];
	if (value === void 0) throw new CronError(`invalid field position ${position}`);
	return value;
}
/** Day 7 is Sunday, exactly like day 0. */
function normalizeDayOfWeek(day) {
	return day === 7 ? 0 : day;
}
/**
* Parse one field into its membership set.
* @param field - the raw field text.
* @param position - 0=minute 1=hour 2=dom 3=month 4=dow.
* @returns the matching values.
*/
function parseField(field, position) {
	const minimum = bound(position, FIELD_MINIMUMS);
	const maximum = bound(position, FIELD_BOUNDS);
	const values = /* @__PURE__ */ new Set();
	for (const part of field.split(",")) {
		const slash = part.indexOf("/");
		const rangeText = slash === -1 ? part : part.slice(0, slash);
		const stepText = slash === -1 ? void 0 : part.slice(slash + 1);
		const step = stepText === void 0 ? 1 : Number(stepText);
		if (stepText !== void 0 && (!/^\d+$/.test(stepText) || step < 1)) throw new CronError(`invalid step "${stepText}" in cron field "${field}"`);
		let from;
		let to;
		if (rangeText === "*") {
			from = minimum;
			to = maximum;
		} else {
			const dash = rangeText.indexOf("-");
			const lowText = dash === -1 ? rangeText : rangeText.slice(0, dash);
			const highText = dash === -1 ? rangeText : rangeText.slice(dash + 1);
			if (!/^\d+$/.test(lowText) || dash !== -1 && !/^\d+$/.test(highText)) throw new CronError(`invalid value "${rangeText}" in cron field "${field}"`);
			from = Number(lowText);
			to = dash === -1 ? from : Number(highText);
			if (from > to) throw new CronError(`descending range "${rangeText}" in cron field "${field}"`);
		}
		for (let raw = from; raw <= to; raw += step) {
			const value = position === 4 ? normalizeDayOfWeek(raw) : raw;
			if (value < minimum || value > maximum) throw new CronError(`value ${raw} out of ${minimum}-${maximum} in cron field "${field}"`);
			values.add(value);
		}
	}
	return values;
}
/**
* Parse a five-field cron expression.
* @param expression - five whitespace-separated fields, numbers only.
* @returns the membership sets.
* @throws {@link CronError} on any malformed field or field count.
*/
function parseCron(expression) {
	const fields = expression.trim().split(/\s+/);
	if (fields.length !== 5) throw new CronError(`cron expression must have 5 fields, got ${fields.length}: "${expression}"`);
	return {
		minute: parseField(fields[0] ?? "", 0),
		hour: parseField(fields[1] ?? "", 1),
		dayOfMonth: parseField(fields[2] ?? "", 2),
		month: parseField(fields[3] ?? "", 3),
		dayOfWeek: parseField(fields[4] ?? "", 4)
	};
}
/** Whether one set covers its whole domain (i.e. the field was unrestricted). */
function isFullSet(set, position) {
	return set.size === bound(position, FIELD_BOUNDS) - bound(position, FIELD_MINIMUMS) + 1;
}
/**
* Whether one local-time minute matches the expression (Vixie day rule).
* @param fields - parsed membership sets.
* @param at - the instant to test; its local minute is the candidate.
* @returns true when the expression fires at that minute.
*/
function cronMatches(fields, at) {
	if (!fields.minute.has(at.getMinutes())) return false;
	if (!fields.hour.has(at.getHours())) return false;
	if (!fields.month.has(at.getMonth() + 1)) return false;
	const domRestricted = !isFullSet(fields.dayOfMonth, 2);
	const dowRestricted = !isFullSet(fields.dayOfWeek, 4);
	const domMatches = fields.dayOfMonth.has(at.getDate());
	const dowMatches = fields.dayOfWeek.has(at.getDay());
	if (domRestricted && dowRestricted) return domMatches || dowMatches;
	if (domRestricted) return domMatches;
	if (dowRestricted) return dowMatches;
	return true;
}
/** The search horizon for the next match: one non-leap-plus year of minutes. */
const MAX_SEARCH_MINUTES = 367 * 24 * 60;
/**
* The next matching minute strictly after `from`, local time.
* @param fields - parsed membership sets.
* @param from - the search starts at the minute after this instant.
* @returns the next matching minute, with seconds and below zeroed.
* @throws {@link CronError} when nothing matches within a year (e.g. Feb 30).
*/
function nextCronTime(fields, from) {
	const candidate = new Date(from);
	candidate.setSeconds(0, 0);
	candidate.setMinutes(candidate.getMinutes() + 1);
	for (let offset = 0; offset < MAX_SEARCH_MINUTES; offset += 1) {
		if (cronMatches(fields, candidate)) return new Date(candidate);
		candidate.setMinutes(candidate.getMinutes() + 1);
	}
	throw new CronError("cron expression matches no time within a year");
}
//#endregion
//#region lib/types/store.js
/**
* The persisted automation table: one lossless-JSON file under the Harness
* home, written atomically. The store is the single writer in this host
* process; reads after load come from memory.
*
* @module @dsh-custom/dsh-automations
*/
/**
* Create a record's identity fields for a fresh automation.
* @returns the id and timestamps a new record carries.
*/
function freshRecordIdentity() {
	return {
		id: randomUUID(),
		createdAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
/**
* The automation table.
*/
var AutomationStore = class {
	file;
	records = /* @__PURE__ */ new Map();
	/**
	* @param file - the JSON file backing the table; loaded lazily.
	*/
	constructor(file) {
		this.file = file;
	}
	/** Load (or start empty when the file is absent). */
	async load() {
		let text;
		try {
			text = await readFile(this.file, "utf8");
		} catch {
			this.records = /* @__PURE__ */ new Map();
			return;
		}
		const tasks = JSON.parse(text).tasks;
		if (!Array.isArray(tasks)) throw new Error(`automations store "${this.file}" is malformed`);
		this.records = new Map(tasks.map((record) => [record.id, record]));
	}
	/** Every record, in creation order. */
	list() {
		return [...this.records.values()];
	}
	/** One record by id. */
	get(id) {
		return this.records.get(id);
	}
	/** Insert or replace one record and persist. */
	async put(record) {
		this.records.set(record.id, record);
		await this.persist();
	}
	/** Delete one record and persist; a no-op when absent. */
	async delete(id) {
		if (!this.records.delete(id)) return;
		await this.persist();
	}
	/** Write the table atomically. */
	async persist() {
		const storeFile = {
			version: 1,
			tasks: this.list()
		};
		await mkdir(dirname(this.file), { recursive: true });
		await writeFileAtomic(this.file, JSON.stringify(storeFile, void 0, 2), { mode: 384 });
	}
	/** The store's default file location under the Harness home. */
	static defaultFile(root) {
		return join(root, "tasks.json");
	}
};
//#endregion
//#region lib/types/service.js
/**
* Machine-level cron automations: a persisted task table, a due-tick
* scheduler with misfire grace, and one agent session per run. Tasks are
* workspace-scoped — each run creates a fresh session the webhook way and
* submits the task's prompt — so scheduled work shows up in the Web Client
* like any other session. The execution step is an overridable method:
* this package's default implementation throws, and the runner wiring lands
* with the base-bundle registration; tests drive a recording subclass.
*
* @module @dsh-custom/dsh-automations
*/
/**
* The machine-level automation registry and scheduler. One tick scans the
* enabled records; a due record advances its schedule first (so a crash
* mid-run never re-fires the same minute) and then executes once. The
* in-flight set keeps a slow run from piling up on the next tick.
*/
var AutomationService = class extends Service {
	static Config = z.object({
		storeRoot: z.string(),
		tickMs: z.number().default(3e4),
		misfireGraceMs: z.number().default(6e5)
	});
	resolved;
	store;
	inFlight = /* @__PURE__ */ new Set();
	loaded = false;
	constructor(ctx, config = {}) {
		super(ctx, "automations");
		this.resolved = {
			storeRoot: config.storeRoot ?? dshHomePath("automations"),
			tickMs: config.tickMs ?? 3e4,
			misfireGraceMs: config.misfireGraceMs ?? 6e5
		};
		this.store = new AutomationStore(AutomationStore.defaultFile(this.resolved.storeRoot));
		const timer = setInterval(() => {
			this.tick();
		}, this.resolved.tickMs);
		ctx.effect(() => () => {
			clearInterval(timer);
		}, "automations: scheduler tick");
		this.tick();
	}
	/** Load the store once; later ticks reuse it. */
	async ensureLoaded() {
		if (this.loaded) return;
		await this.store.load();
		this.loaded = true;
	}
	/** Every automation, in creation order. */
	async list() {
		await this.ensureLoaded();
		return this.store.list();
	}
	/**
	* Create one automation; the first run time is computed immediately.
	* @param options - the label, workspace, prompt, cron expression, presets.
	* @returns the created record.
	* @throws {@link CronError} on a malformed expression; Error on a relative
	* workspace path or empty fields.
	*/
	async create(options) {
		await this.ensureLoaded();
		if (options.title.trim() === "") throw new Error("automation title must be non-empty");
		if (options.prompt.trim() === "") throw new Error("automation prompt must be non-empty");
		if (!isAbsolute(options.workspacePath)) throw new Error(`automation workspacePath must be absolute, got "${options.workspacePath}"`);
		const fields = parseCron(options.cron);
		const record = {
			...freshRecordIdentity(),
			title: options.title,
			workspacePath: options.workspacePath,
			prompt: options.prompt,
			cron: options.cron,
			enabled: true,
			...options.agentPreset !== void 0 ? { agentPreset: options.agentPreset } : {},
			...options.permissionPreset !== void 0 ? { permissionPreset: options.permissionPreset } : {},
			nextRunAt: nextCronTime(fields, /* @__PURE__ */ new Date()).toISOString(),
			lastRunAt: null
		};
		await this.store.put(record);
		return record;
	}
	/**
	* Change one automation's editable fields; a cron change recomputes the
	* next run from now.
	* @param id - the automation to change.
	* @param options - the fields to replace.
	* @returns the updated record.
	* @throws Error when the automation is unknown.
	*/
	async update(id, options) {
		await this.ensureLoaded();
		const current = this.store.get(id);
		if (current === void 0) throw new Error(`automation "${id}" not found`);
		const cron = options.cron ?? current.cron;
		const nextRunAt = options.cron !== void 0 ? nextCronTime(parseCron(cron), /* @__PURE__ */ new Date()).toISOString() : current.nextRunAt;
		const updated = {
			...current,
			...options.title !== void 0 ? { title: options.title } : {},
			...options.prompt !== void 0 ? { prompt: options.prompt } : {},
			...options.enabled !== void 0 ? { enabled: options.enabled } : {},
			...options.agentPreset !== void 0 ? { agentPreset: options.agentPreset } : {},
			...options.permissionPreset !== void 0 ? { permissionPreset: options.permissionPreset } : {},
			cron,
			nextRunAt
		};
		await this.store.put(updated);
		return updated;
	}
	/**
	* Delete one automation.
	* @param id - the automation to remove.
	*/
	async remove(id) {
		await this.ensureLoaded();
		await this.store.delete(id);
	}
	/**
	* Fire one automation now, outside its schedule; the schedule is untouched.
	* @param id - the automation to fire.
	* @throws Error when the automation is unknown or a run is already in flight.
	*/
	async runNow(id) {
		await this.ensureLoaded();
		const record = this.store.get(id);
		if (record === void 0) throw new Error(`automation "${id}" not found`);
		await this.fire(record);
	}
	/**
	* One scheduler pass: advance or fire every due enabled record.
	*/
	async tick() {
		await this.ensureLoaded();
		const now = Date.now();
		for (const record of this.store.list()) {
			if (!record.enabled || record.nextRunAt === null) continue;
			const dueAt = Date.parse(record.nextRunAt);
			if (Number.isNaN(dueAt) || dueAt > now) continue;
			if (now - dueAt > this.resolved.misfireGraceMs) {
				await this.advance(record, new Date(now));
				continue;
			}
			if (this.inFlight.has(record.id)) continue;
			await this.advance(record, new Date(now));
			this.fire(record).catch(() => {});
		}
	}
	/** Move one record's schedule to its next run after `from` and persist. */
	async advance(record, from) {
		const next = nextCronTime(parseCron(record.cron), from);
		const updated = {
			...record,
			nextRunAt: next.toISOString()
		};
		await this.store.put(updated);
		return updated;
	}
	/** Run one automation once, recording the outcome either way. */
	async fire(record) {
		if (this.inFlight.has(record.id)) throw new Error(`automation "${record.id}" is already running`);
		this.inFlight.add(record.id);
		try {
			await this.execute(record);
			await this.settle(record, {
				lastRunAt: (/* @__PURE__ */ new Date()).toISOString(),
				lastOutcome: "ok"
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await this.settle(record, {
				lastRunAt: (/* @__PURE__ */ new Date()).toISOString(),
				lastOutcome: "error",
				lastError: message
			});
			this.ctx.logger.warn(`automation "${record.id}" run failed: ${message}`);
			throw error;
		} finally {
			this.inFlight.delete(record.id);
		}
	}
	/** Merge one run outcome onto the record's CURRENT stored state. */
	async settle(record, outcome) {
		const current = this.store.get(record.id) ?? record;
		await this.store.put({
			...current,
			lastRunAt: outcome.lastRunAt,
			lastOutcome: outcome.lastOutcome,
			...outcome.lastError !== void 0 ? { lastError: outcome.lastError } : {}
		});
	}
	/**
	* Execute one automation run. The default implementation throws — the
	* runner wiring (agent session creation, webhook style) replaces it in the
	* composed host, and tests drive a recording subclass.
	* @param record - the automation to run.
	*/
	async execute(_record) {
		throw new Error("automations: no executor is mounted");
	}
};
//#endregion
//#region lib/types/runner.js
/**
* The composed-host automation service: the table-and-scheduler base with the
* webhook-recipe runner — each fire creates one ordinary workspace session
* (titled by the task), configures its presets, and submits the prompt.
* Prompt admission ends the runner's ownership: the agent follows normal
* session behavior from there.
*
* @module @dsh-custom/dsh-automations
*/
/** The permission preset a task carries when it names none. */
const DEFAULT_PERMISSION_PRESET = "workspace-write";
var RunnerAutomationService = class extends AutomationService {
	static inject = [
		"agents",
		"agentDefaultModel",
		"agentPresets",
		"permissionPresets",
		"sessionTitle",
		"workspaceRegistry"
	];
	/** Aborted when the plugin unloads: no run outlives its host. */
	runSignal = new AbortController();
	constructor(ctx, config = {}) {
		super(ctx, config);
		ctx.effect(() => () => this.runSignal.abort(), "automations: runner lifetime");
	}
	async execute(record) {
		const ctx = this.ctx;
		const signal = this.runSignal.signal;
		const permissionPreset = record.permissionPreset ?? DEFAULT_PERMISSION_PRESET;
		ctx.permissionPresets.resolve(permissionPreset);
		const presetId = record.agentPreset ?? ctx.agentPresets.defaultId;
		const preset = await ctx.agentPresets.resolve(presetId);
		await ctx.agentPresets.standingKeyFor(preset.id);
		signal.throwIfAborted();
		const workspace = await ctx.workspaceRegistry.create(record.workspacePath);
		signal.throwIfAborted();
		const sessionId = brandString(`automation-${randomUUID()}`);
		const selection = ctx.agentDefaultModel.currentSelection();
		const handle = await ctx.agents.create({
			sessionId,
			signal,
			meta: {
				cwd: workspace.path,
				agentPreset: preset.id
			},
			agentOptions: {
				provider: selection.provider,
				model: selection.model
			},
			setup: async (agentCtx) => {
				await ctx.agentPresets.mount(agentCtx, preset.id);
			}
		});
		let attached = false;
		try {
			signal.throwIfAborted();
			await workspace.attachSession(sessionId);
			attached = true;
			signal.throwIfAborted();
			ctx.permissionPresets.set(handle.agent.session, permissionPreset);
			ctx.sessionTitle.rename(handle.agent.session, record.title);
			handle.agent.followup(createUserMessage({
				content: [{
					type: "text",
					text: record.prompt
				}],
				source: {
					kind: "plugin",
					plugin: "dsh-automations"
				}
			}));
		} catch (error) {
			if (attached) try {
				await workspace.detachSession(sessionId);
			} catch (rollbackError) {
				ctx.logger.warn(`automations: workspace detach for session ${String(sessionId)} failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
			}
			try {
				await handle.dispose();
			} catch (rollbackError) {
				ctx.logger.warn(`automations: agent disposal for session ${String(sessionId)} failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
			}
			throw error;
		}
	}
};
//#endregion
export { AutomationService, AutomationStore, CronError, RunnerAutomationService, RunnerAutomationService as default, cronMatches, freshRecordIdentity, nextCronTime, parseCron };
