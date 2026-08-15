/**
 * Changes plugin, browser half: mounts the changeMonitor Remote namespace
 * (api-remotes does not include it), then registers the turn-tail changes row
 * under every completed turn. All data flows through a per-session
 * controller; every failure degrades to "no changes", never an error.
 * @module @deepseek-ai/dsh-client-ui-change-monitor/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type ChangeMonitorKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Changes-panel copy. */
        'changeMonitor': ChangeMonitorKey;
    }
}
/** Required services: slot registry, Remote carrier, locale, the wire handle, and the session scope tree. */
export declare const inject: string[];
/**
 * Client plugin body: mount the Remote, register dictionaries, and the
 * turn-tail changes row.
 * @param ctx - client root context.
 * @returns disposer that unmounts the Remote and drops every controller.
 */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map