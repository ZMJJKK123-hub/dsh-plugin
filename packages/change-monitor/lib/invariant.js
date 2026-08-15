//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@dsh-custom/dsh-change-monitor`.
* @module @dsh-custom/dsh-change-monitor/invariant
*/
const PACKAGE_NAME = "@dsh-custom/dsh-change-monitor";
/** Cordis companion plugin name. */
const name = "change-monitor-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: every ChangeSet is an independent best-effort
* snapshot observation with no cross-event or mutable-data relationship that
* other packages depend on.
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
