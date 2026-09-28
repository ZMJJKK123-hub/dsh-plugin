/**
 * Best-effort shadow checkpoint at every turn start: when a session with a
 * workspace enters a turn, one git checkpoint lands in the session's own
 * series before the turn's writes can happen. Checkpointing is strictly
 * best-effort — a failure logs a warning and never affects the agent turn —
 * and a workspace outside any git repository is simply skipped.
 *
 * @module @dsh-custom/dsh-checkpoint-watcher
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "checkpoint-watcher";
/** Services required by the watcher. */
export declare const inject: string[];
/** Plugin config (all optional — `Config` supplies the defaults). */
export interface Config {
    /** Set false to stop taking turn checkpoints without removing the row. */
    enabled?: boolean;
}
export declare const Config: z<Config>;
/**
 * Watch turn starts and checkpoint each one.
 * @param ctx - host context carrying the git seam and the session event feed.
 * @param config - the enabled switch.
 */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map