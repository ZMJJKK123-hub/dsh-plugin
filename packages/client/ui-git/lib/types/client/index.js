/**
 * Browser half: mount the `gitRemote` Remote namespace (api-remotes selects a
 * fixed list and does not include it), then register the source-control tab
 * type and its body under the keyed `sidebar.right.pane.tab` seat.
 * @module @dsh-custom/dsh-client-ui-git/client
 */
import gitRemoteClient from '@dsh-custom/dsh-git-remote/remote';
import { GIT_ID, gitDefinition } from "./definition.js";
import { gitFace } from "./face.js";
import { GitBody } from "./GitBody.js";
import { en, zh } from "./locales.js";
import { createGitStore } from "./store.js";
/** Copy namespace this package owns; the key-set merge lives in locales.ts. */
const NS = 'gitPanel';
/** Required browser services: the slot registry, the tab registry, the Remote carrier, and copy. */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'remote'];
/**
 * Client plugin body: mount the Remote, register dictionaries, the tab type,
 * then its body.
 * @param ctx - client root context.
 * @returns disposer that unmounts the Remote namespace.
 */
export async function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-git: dictionaries');
    // Mount our own Remote namespace: api-remotes selects a fixed list and does
    // not include gitRemote, so this package mounts it at its own boundary and
    // reads it via `ctx.get` (injecting the very namespace this plugin mounts
    // would deadlock).
    const unmountRemote = await ctx.remote.$mount(gitRemoteClient);
    const mounted = ctx.get('remote.gitRemote');
    if (mounted === undefined) {
        await unmountRemote();
        throw new Error('ui-git: the gitRemote Remote namespace did not mount');
    }
    const remote = mounted;
    const t = ctx.locale.bind(NS);
    ctx.effect(() => ctx.sidebarRightTabs.register(gitDefinition(t)), 'ui-git: git type');
    const store = createGitStore();
    const injectFace = gitFace(remote);
    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: GIT_ID, locale: NS, store, inject: injectFace }, GitBody)), 'ui-git: git tab body');
    return async () => {
        await unmountRemote();
    };
}
//# sourceMappingURL=index.js.map