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
import type { Context } from '@deepseek-ai/cordis';
import { Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { AutomationStore, type AutomationRecord } from './store.ts';
/** What one automation creation supplies. */
export interface AutomationCreateOptions {
    readonly title: string;
    readonly workspacePath: string;
    readonly prompt: string;
    readonly cron: string;
    readonly agentPreset?: string;
    readonly permissionPreset?: string;
}
/** What one automation update may change. */
export interface AutomationUpdateOptions {
    readonly title?: string;
    readonly prompt?: string;
    readonly cron?: string;
    readonly enabled?: boolean;
    readonly agentPreset?: string;
    readonly permissionPreset?: string;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        automations: AutomationService;
    }
}
/** Plugin config (all optional — `static Config` supplies the defaults). */
export interface Config {
    /** Store directory under (or alongside) the Harness home. */
    storeRoot?: string;
    /** Scheduler tick interval in milliseconds. */
    tickMs?: number;
    /** A run whose time came this long ago is skipped as missed, not fired. */
    misfireGraceMs?: number;
}
/**
 * The machine-level automation registry and scheduler. One tick scans the
 * enabled records; a due record advances its schedule first (so a crash
 * mid-run never re-fires the same minute) and then executes once. The
 * in-flight set keeps a slow run from piling up on the next tick.
 */
export declare class AutomationService extends Service {
    static Config: z<Config>;
    private readonly resolved;
    protected readonly store: AutomationStore;
    private readonly inFlight;
    private loaded;
    constructor(ctx: Context, config?: Config);
    /** Load the store once; later ticks reuse it. */
    private ensureLoaded;
    /** Every automation, in creation order. */
    list(): Promise<readonly AutomationRecord[]>;
    /**
     * Create one automation; the first run time is computed immediately.
     * @param options - the label, workspace, prompt, cron expression, presets.
     * @returns the created record.
     * @throws {@link CronError} on a malformed expression; Error on a relative
     * workspace path or empty fields.
     */
    create(options: AutomationCreateOptions): Promise<AutomationRecord>;
    /**
     * Change one automation's editable fields; a cron change recomputes the
     * next run from now.
     * @param id - the automation to change.
     * @param options - the fields to replace.
     * @returns the updated record.
     * @throws Error when the automation is unknown.
     */
    update(id: string, options: AutomationUpdateOptions): Promise<AutomationRecord>;
    /**
     * Delete one automation.
     * @param id - the automation to remove.
     */
    remove(id: string): Promise<void>;
    /**
     * Fire one automation now, outside its schedule; the schedule is untouched.
     * @param id - the automation to fire.
     * @throws Error when the automation is unknown or a run is already in flight.
     */
    runNow(id: string): Promise<void>;
    /**
     * One scheduler pass: advance or fire every due enabled record.
     */
    protected tick(): Promise<void>;
    /** Move one record's schedule to its next run after `from` and persist. */
    private advance;
    /** Run one automation once, recording the outcome either way. */
    private fire;
    /** Merge one run outcome onto the record's CURRENT stored state. */
    private settle;
    /**
     * Execute one automation run. The default implementation throws — the
     * runner wiring (agent session creation, webhook style) replaces it in the
     * composed host, and tests drive a recording subclass.
     * @param record - the automation to run.
     */
    protected execute(_record: AutomationRecord): Promise<void>;
}
export default AutomationService;
//# sourceMappingURL=service.d.ts.map