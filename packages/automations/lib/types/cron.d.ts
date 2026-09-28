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
/** The parsed membership sets of one cron expression. */
export interface CronFields {
    readonly minute: ReadonlySet<number>;
    readonly hour: ReadonlySet<number>;
    readonly dayOfMonth: ReadonlySet<number>;
    readonly month: ReadonlySet<number>;
    readonly dayOfWeek: ReadonlySet<number>;
}
/** One invalid expression. */
export declare class CronError extends Error {
    constructor(message: string);
}
/**
 * Parse a five-field cron expression.
 * @param expression - five whitespace-separated fields, numbers only.
 * @returns the membership sets.
 * @throws {@link CronError} on any malformed field or field count.
 */
export declare function parseCron(expression: string): CronFields;
/**
 * Whether one local-time minute matches the expression (Vixie day rule).
 * @param fields - parsed membership sets.
 * @param at - the instant to test; its local minute is the candidate.
 * @returns true when the expression fires at that minute.
 */
export declare function cronMatches(fields: CronFields, at: Date): boolean;
/**
 * The next matching minute strictly after `from`, local time.
 * @param fields - parsed membership sets.
 * @param from - the search starts at the minute after this instant.
 * @returns the next matching minute, with seconds and below zeroed.
 * @throws {@link CronError} when nothing matches within a year (e.g. Feb 30).
 */
export declare function nextCronTime(fields: CronFields, from: Date): Date;
//# sourceMappingURL=cron.d.ts.map