//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@dsh-custom/dsh-client-ui-voice-input`.
* @module @dsh-custom/dsh-client-ui-voice-input/invariant
*/
const PACKAGE_NAME = "@dsh-custom/dsh-client-ui-voice-input";
/** Cordis companion plugin name. */
const name = "client-ui-voice-input-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: a single slot registration whose disposal is proven
* by the HMR-safety spec — it emits no cordis events and owns no cross-plugin
* mutable state.
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
