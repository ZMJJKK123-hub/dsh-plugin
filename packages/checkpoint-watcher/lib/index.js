import z from "@deepseek-ai/schemastery";
//#region lib/types/index.js
/**
* Best-effort shadow checkpoint at every turn start: when a session with a
* workspace enters a turn, one git checkpoint lands in the session's own
* series before the turn's writes can happen. Checkpointing is strictly
* best-effort — a failure logs a warning and never affects the agent turn —
* and a workspace outside any git repository is simply skipped.
*
* @module @dsh-custom/dsh-checkpoint-watcher
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "checkpoint-watcher";
/** Services required by the watcher. */
const inject = ["git"];
const Config = z.object({ enabled: z.boolean().default(true) });
/**
* Watch turn starts and checkpoint each one.
* @param ctx - host context carrying the git seam and the session event feed.
* @param config - the enabled switch.
*/
function apply(ctx, config = {}) {
	if (config.enabled === false) return;
	ctx.on("session/event", (session, event) => {
		if (event.type !== "turn/start") return;
		const cwd = session.header.cwd;
		if (cwd === void 0) return;
		const turn = event.data.turn ?? 0;
		const series = String(session.id);
		ctx.git.checkpointCreate(cwd, {
			series,
			index: turn,
			label: `turn ${turn}`
		}).catch((error) => {
			ctx.logger.warn(`checkpoint watcher: turn ${turn} checkpoint failed: ${error instanceof Error ? error.message : String(error)}`);
		});
	});
}
//#endregion
export { Config, apply, inject, name };
