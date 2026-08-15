/**
 * Voice input plugin, browser half: registers the mic button into the
 * composer's tool-row right seat. No Remote, no Host state — everything runs
 * in the browser through the Web Speech API and the session input actions.
 * @module @dsh-custom/dsh-client-ui-voice-input/client
 */
import { VoiceInput } from "./VoiceInput.js";
import { en, NS, zh } from "./locales.js";
/** Required services: the slot registry and the locale dictionaries. */
export const inject = ['slots', 'locale'];
/**
 * Client plugin body: register the dictionaries and the composer mic entry.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-voice-input: dictionaries');
    ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
        name: 'conversation.input.right',
        id: 'voice-input',
        order: 5,
        locale: NS,
    }, VoiceInput));
}
//# sourceMappingURL=index.js.map