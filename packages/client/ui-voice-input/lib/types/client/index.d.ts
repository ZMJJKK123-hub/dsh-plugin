/**
 * Voice input plugin, browser half: registers the mic button into the
 * composer's tool-row right seat. No Remote, no Host state — everything runs
 * in the browser through the Web Speech API and the session input actions.
 * @module @dsh-custom/dsh-client-ui-voice-input/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type VoiceInputKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Voice-input button copy. */
        'voiceInput': VoiceInputKey;
    }
}
/** Required services: the slot registry and the locale dictionaries. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries and the composer mic entry.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map