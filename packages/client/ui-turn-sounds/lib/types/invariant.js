/**
 * Package-owned invariant companion for `@dsh-custom/dsh-client-ui-turn-sounds`.
 * @module @dsh-custom/dsh-client-ui-turn-sounds/invariant
 */
const PACKAGE_NAME = '@dsh-custom/dsh-client-ui-turn-sounds';
/** Cordis companion plugin name. */
export const name = 'client-ui-turn-sounds-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: a presentation plugin that plays browser sounds and
 * exposes a settings page; it owns no cross-plugin mutable state or events.
 */
const install = () => { };
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
//# sourceMappingURL=invariant.js.map