//#region lib/types/index.js
/**
* Host half of the automations panel: presence only. The Loader needs this
* package in the cordis graph so the browser bundle's `dsh.client` manifest
* resolves; everything the panel does lives in `./client`.
*
* @module @dsh-custom/dsh-client-ui-automations
*/
const name = "ui-automations";
function apply() {}
//#endregion
export { apply, name };
