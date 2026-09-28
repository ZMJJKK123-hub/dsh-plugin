/**
 * The persisted automation table: one lossless-JSON file under the Harness
 * home, written atomically. The store is the single writer in this host
 * process; reads after load come from memory.
 *
 * @module @dsh-custom/dsh-automations
 */
/** One machine-level automation. */
export interface AutomationRecord {
    /** Stable unique id. */
    readonly id: string;
    /** Human label; becomes the session title of every run. */
    readonly title: string;
    /** Absolute workspace path every run's session is created in. */
    readonly workspacePath: string;
    /** The prompt submitted at every run. */
    readonly prompt: string;
    /** The five-field cron expression, local time. */
    readonly cron: string;
    /** Disabled tasks never fire but keep their schedule bookkeeping. */
    readonly enabled: boolean;
    /** Agent preset id; omitted means the registry's default. */
    readonly agentPreset?: string;
    /** Permission preset name; omitted means `workspace-write`. */
    readonly permissionPreset?: string;
    readonly createdAt: string;
    /** ISO timestamp of the next scheduled run; null when never computed. */
    readonly nextRunAt: string | null;
    /** ISO timestamp of the last started run. */
    readonly lastRunAt: string | null;
    /** The last run's outcome, once one has settled. */
    readonly lastOutcome?: 'ok' | 'error';
    /** The last failure's message, when the outcome was error. */
    readonly lastError?: string;
}
/**
 * Create a record's identity fields for a fresh automation.
 * @returns the id and timestamps a new record carries.
 */
export declare function freshRecordIdentity(): {
    id: string;
    createdAt: string;
};
/**
 * The automation table.
 */
export declare class AutomationStore {
    private readonly file;
    private records;
    /**
     * @param file - the JSON file backing the table; loaded lazily.
     */
    constructor(file: string);
    /** Load (or start empty when the file is absent). */
    load(): Promise<void>;
    /** Every record, in creation order. */
    list(): readonly AutomationRecord[];
    /** One record by id. */
    get(id: string): AutomationRecord | undefined;
    /** Insert or replace one record and persist. */
    put(record: AutomationRecord): Promise<void>;
    /** Delete one record and persist; a no-op when absent. */
    delete(id: string): Promise<void>;
    /** Write the table atomically. */
    private persist;
    /** The store's default file location under the Harness home. */
    static defaultFile(root: string): string;
}
//# sourceMappingURL=store.d.ts.map