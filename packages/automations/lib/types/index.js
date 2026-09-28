/**
 * Package barrel: the scheduler surface (service, store, cron) and the
 * composed-host default — the runner variant whose execute creates one
 * workspace session per fire. Tests that drive the scheduler semantics
 * import the base by name.
 *
 * @module @dsh-custom/dsh-automations
 */
export { CronError, cronMatches, nextCronTime, parseCron } from "./cron.js";
export { AutomationStore, freshRecordIdentity } from "./store.js";
export { AutomationService } from "./service.js";
export { RunnerAutomationService } from "./runner.js";
export { default } from "./runner.js";
//# sourceMappingURL=index.js.map