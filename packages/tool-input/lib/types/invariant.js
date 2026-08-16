/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-tool-input`.
 * @module @deepseek-ai/dsh-tool-input/invariant
 */
const PACKAGE_NAME = '@deepseek-ai/dsh-tool-input';
/** Cordis companion plugin name. */
export const name = 'tool-input-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: a tool plugin that simulates mouse/keyboard input; it
 * owns no cross-plugin mutable state or events.
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