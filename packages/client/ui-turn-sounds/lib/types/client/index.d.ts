/**
 * Turn sound notifications, browser half: plays a completion chime when a
 * turn ends and a question chime when the agent asks the user, with settings
 * under a dedicated "提示音" settings page.
 *
 * @module @deepseek-ai/dsh-client-ui-turn-sounds/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Services required by the browser plugin. */
export declare const inject: string[];
/**
 * Register the settings page and the session-event sound listener.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map