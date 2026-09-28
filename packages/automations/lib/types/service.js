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
import { Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { isAbsolute } from 'node:path';
import { setInterval as plainSetInterval } from 'node:timers';
import { nextCronTime, parseCron } from "./cron.js";
import { AutomationStore, freshRecordIdentity } from "./store.js";
/**
 * The machine-level automation registry and scheduler. One tick scans the
 * enabled records; a due record advances its schedule first (so a crash
 * mid-run never re-fires the same minute) and then executes once. The
 * in-flight set keeps a slow run from piling up on the next tick.
 */
export class AutomationService extends Service {
    static Config = z.object({
        storeRoot: z.string(),
        tickMs: z.number().default(30_000),
        misfireGraceMs: z.number().default(600_000),
    });
    resolved;
    store;
    inFlight = new Set();
    loaded = false;
    constructor(ctx, config = {}) {
        super(ctx, 'automations');
        this.resolved = {
            storeRoot: config.storeRoot ?? dshHomePath('automations'),
            tickMs: config.tickMs ?? 30_000,
            misfireGraceMs: config.misfireGraceMs ?? 600_000,
        };
        this.store = new AutomationStore(AutomationStore.defaultFile(this.resolved.storeRoot));
        // The interval is effect-owned: plugin disposal stops the ticks.
        const timer = plainSetInterval(() => { void this.tick(); }, this.resolved.tickMs);
        ctx.effect(() => () => { clearInterval(timer); }, 'automations: scheduler tick');
        // One immediate tick once the store is loadable, without blocking construction.
        void this.tick();
    }
    /** Load the store once; later ticks reuse it. */
    async ensureLoaded() {
        if (this.loaded)
            return;
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
        if (options.title.trim() === '')
            throw new Error('automation title must be non-empty');
        if (options.prompt.trim() === '')
            throw new Error('automation prompt must be non-empty');
        if (!isAbsolute(options.workspacePath)) {
            throw new Error(`automation workspacePath must be absolute, got "${options.workspacePath}"`);
        }
        const fields = parseCron(options.cron);
        const identity = freshRecordIdentity();
        const record = {
            ...identity,
            title: options.title,
            workspacePath: options.workspacePath,
            prompt: options.prompt,
            cron: options.cron,
            enabled: true,
            ...options.agentPreset !== undefined ? { agentPreset: options.agentPreset } : {},
            ...options.permissionPreset !== undefined ? { permissionPreset: options.permissionPreset } : {},
            nextRunAt: nextCronTime(fields, new Date()).toISOString(),
            lastRunAt: null,
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
        if (current === undefined)
            throw new Error(`automation "${id}" not found`);
        const cron = options.cron ?? current.cron;
        const nextRunAt = options.cron !== undefined
            ? nextCronTime(parseCron(cron), new Date()).toISOString()
            : current.nextRunAt;
        const updated = {
            ...current,
            ...options.title !== undefined ? { title: options.title } : {},
            ...options.prompt !== undefined ? { prompt: options.prompt } : {},
            ...options.enabled !== undefined ? { enabled: options.enabled } : {},
            ...options.agentPreset !== undefined ? { agentPreset: options.agentPreset } : {},
            ...options.permissionPreset !== undefined ? { permissionPreset: options.permissionPreset } : {},
            cron,
            nextRunAt,
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
        if (record === undefined)
            throw new Error(`automation "${id}" not found`);
        await this.fire(record);
    }
    /**
     * One scheduler pass: advance or fire every due enabled record.
     */
    async tick() {
        await this.ensureLoaded();
        const now = Date.now();
        for (const record of this.store.list()) {
            if (!record.enabled || record.nextRunAt === null)
                continue;
            const dueAt = Date.parse(record.nextRunAt);
            if (Number.isNaN(dueAt) || dueAt > now)
                continue;
            if (now - dueAt > this.resolved.misfireGraceMs) {
                // The host was away across the run time: skip the missed run(s) and
                // reschedule from now rather than firing a stale prompt.
                await this.advance(record, new Date(now));
                continue;
            }
            if (this.inFlight.has(record.id))
                continue;
            await this.advance(record, new Date(now));
            // The tick owns the fire-and-forget: a failure was recorded and logged.
            void this.fire(record).catch(() => { });
        }
    }
    /** Move one record's schedule to its next run after `from` and persist. */
    async advance(record, from) {
        const next = nextCronTime(parseCron(record.cron), from);
        const updated = { ...record, nextRunAt: next.toISOString() };
        await this.store.put(updated);
        return updated;
    }
    /** Run one automation once, recording the outcome either way. */
    async fire(record) {
        if (this.inFlight.has(record.id))
            throw new Error(`automation "${record.id}" is already running`);
        this.inFlight.add(record.id);
        try {
            await this.execute(record);
            await this.settle(record, { lastRunAt: new Date().toISOString(), lastOutcome: 'ok' });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.settle(record, {
                lastRunAt: new Date().toISOString(),
                lastOutcome: 'error',
                lastError: message,
            });
            this.ctx.logger.warn(`automation "${record.id}" run failed: ${message}`);
            throw error;
        }
        finally {
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
            ...outcome.lastError !== undefined ? { lastError: outcome.lastError } : {},
        });
    }
    /**
     * Execute one automation run. The default implementation throws — the
     * runner wiring (agent session creation, webhook style) replaces it in the
     * composed host, and tests drive a recording subclass.
     * @param record - the automation to run.
     */
    async execute(_record) {
        throw new Error('automations: no executor is mounted');
    }
}
export default AutomationService;
//# sourceMappingURL=service.js.map