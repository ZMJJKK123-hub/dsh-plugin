//#region lib/types/index.js
/**
* Node half of the change-monitor UI plugin. The browser half does all the
* work; this empty apply keeps the package loadable in host-side contexts
* (the `dsh.client` manifest marks the browser face).
* @module @deepseek-ai/dsh-client-ui-change-monitor
*/
function apply() {}
//#endregion
export { apply };
