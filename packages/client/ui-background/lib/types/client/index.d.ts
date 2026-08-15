/**
 * Background plugin, browser half: registers the General-settings background
 * row and injects the global style that reveals the body background image by
 * making the page-level surfaces transparent while `data-dsh-bg` is set.
 * Everything runs in the browser — localStorage persistence, no Host state.
 * @module @dsh-custom/dsh-client-ui-background/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type BackgroundKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Background row copy. */
        'background': BackgroundKey;
    }
}
/** Required services: the slot registry and the locale dictionaries. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries, the background row, and the
 * global style; restore the persisted background on boot.
 * @param ctx - client root context.
 * @returns disposer removing the style and the applied background.
 */
export declare function apply(ctx: ClientContext): () => void;
//# sourceMappingURL=index.d.ts.map