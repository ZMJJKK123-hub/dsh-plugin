/**
 * The Zai brand palettes ported from ZCode (`theme-zai-light` /
 * `theme-zai-dark` in ZCode's styles.css) onto the dsh alias-token layer:
 * each theme picks a base scheme and overrides the 14 documented alias
 * tokens with the ported values, so every UI built on the alias layer
 * re-skins without touching the base palettes.
 *
 * @module @dsh-custom/dsh-client-ui-theme-zai/client
 */
import { ZAI_DARK, ZAI_LIGHT } from "./themes.js";
/** Required browser services: the theme registry. */
export const inject = ['theme'];
/**
 * Client plugin body: register both Zai themes.
 * @param ctx - client root context carrying the theme runtime.
 * @returns disposer removing both themes.
 */
export function apply(ctx) {
    const disposeLight = ctx.theme.register(ZAI_LIGHT);
    let disposeDark;
    try {
        disposeDark = ctx.theme.register(ZAI_DARK);
    }
    catch (error) {
        disposeLight();
        throw error;
    }
    return () => {
        disposeDark();
        disposeLight();
    };
}
//# sourceMappingURL=index.js.map