/**
 * The persisted automation table: one lossless-JSON file under the Harness
 * home, written atomically. The store is the single writer in this host
 * process; reads after load come from memory.
 *
 * @module @dsh-custom/dsh-automations
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
/**
 * Create a record's identity fields for a fresh automation.
 * @returns the id and timestamps a new record carries.
 */
export function freshRecordIdentity() {
    return { id: randomUUID(), createdAt: new Date().toISOString() };
}
/**
 * The automation table.
 */
export class AutomationStore {
    file;
    records = new Map();
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
            text = await readFile(this.file, 'utf8');
        }
        catch {
            this.records = new Map();
            return;
        }
        const parsed = JSON.parse(text);
        const tasks = parsed.tasks;
        if (!Array.isArray(tasks)) {
            throw new Error(`automations store "${this.file}" is malformed`);
        }
        this.records = new Map(tasks.map(record => [record.id, record]));
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
        if (!this.records.delete(id))
            return;
        await this.persist();
    }
    /** Write the table atomically. */
    async persist() {
        const storeFile = { version: 1, tasks: this.list() };
        await mkdir(dirname(this.file), { recursive: true });
        await writeFileAtomic(this.file, JSON.stringify(storeFile, undefined, 2), { mode: 0o600 });
    }
    /** The store's default file location under the Harness home. */
    static defaultFile(root) {
        return join(root, 'tasks.json');
    }
}
//# sourceMappingURL=store.js.map