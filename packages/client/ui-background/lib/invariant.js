//#region lib/types/invariant.js
/**
* Runtime invariant companion for @deepseek-ai/dsh-client-ui-background.
* The plugin is pure browser presentation with no session-event or service
* relationship to assert: it reads localStorage and paints the body, which
* no other package observes. No runtime invariant.
*/
/** The empty invariant installer this package registers (no-op by design). */
function install() {}
//#endregion
export { install };
