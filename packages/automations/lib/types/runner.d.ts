/**
 * The composed-host automation service: the table-and-scheduler base with the
 * webhook-recipe runner — each fire creates one ordinary workspace session
 * (titled by the task), configures its presets, and submits the prompt.
 * Prompt admission ends the runner's ownership: the agent follows normal
 * session behavior from there.
 *
 * @module @dsh-custom/dsh-automations
 */
import type { Context } from '@deepseek-ai/cordis';
import type { AutomationRecord } from './store.ts';
import { AutomationService } from './service.ts';
export declare class RunnerAutomationService extends AutomationService {
    static inject: string[];
    /** Aborted when the plugin unloads: no run outlives its host. */
    private readonly runSignal;
    constructor(ctx: Context, config?: Record<string, unknown>);
    execute(record: AutomationRecord): Promise<void>;
}
export default RunnerAutomationService;
//# sourceMappingURL=runner.d.ts.map