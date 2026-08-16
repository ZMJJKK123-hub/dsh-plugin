//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@dsh-custom/dsh-client-ui-turn-sounds`.
* @module @dsh-custom/dsh-client-ui-turn-sounds/invariant
*/
const PACKAGE_NAME = "@dsh-custom/dsh-client-ui-turn-sounds";
/** Cordis companion plugin name. */
const name = "client-ui-turn-sounds-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: a presentation plugin that plays browser sounds and
* exposes a settings page; it owns no cross-plugin mutable state or events.
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
