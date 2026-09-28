/**
 * Browser half: mount the `automationsRemote` Remote namespace (api-remotes
 * selects a fixed list and does not include it), then register the
 * automations tab type and its body under the keyed `sidebar.right.pane.tab`
 * seat.
 * @module @dsh-custom/dsh-client-ui-automations/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
/** Required browser services: the slot registry, the tab registry, the Remote carrier, and copy. */
export declare const inject: string[];
/**
 * Client plugin body: mount the Remote, register dictionaries, the tab type,
 * then its body.
 * @param ctx - client root context.
 * @returns disposer that unmounts the Remote namespace.
 */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map