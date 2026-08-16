/**
 * Package-owned invariant companion for `@dsh-custom/dsh-tool-browser`.
 * @module @dsh-custom/dsh-tool-browser/invariant
 */
const PACKAGE_NAME = '@dsh-custom/dsh-tool-browser';
/** Cordis companion plugin name. */
export const name = 'tool-browser-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: the browser tool owns per-session child processes and
 * tool registrations; its ownership/disposal is proven by the HMR-safety spec.
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