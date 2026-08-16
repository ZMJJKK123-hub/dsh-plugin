//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@deepseek-ai/dsh-tool-browser`.
* @module @deepseek-ai/dsh-tool-browser/invariant
*/
const PACKAGE_NAME = "@deepseek-ai/dsh-tool-browser";
/** Cordis companion plugin name. */
const name = "tool-browser-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: the browser tool owns per-session child processes and
* tool registrations; its ownership/disposal is proven by the HMR-safety spec.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
