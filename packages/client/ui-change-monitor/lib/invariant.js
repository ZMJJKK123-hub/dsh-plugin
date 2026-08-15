//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@dsh-custom/dsh-client-ui-change-monitor`.
* @module @dsh-custom/dsh-client-ui-change-monitor/invariant
*/
const PACKAGE_NAME = "@dsh-custom/dsh-client-ui-change-monitor";
/** Cordis companion plugin name. */
const name = "ui-change-monitor-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: the changes panel is a read-only projection of the
* Host changeMonitor Remote with no cross-event or mutable-data relationship.
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
