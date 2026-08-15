/**
 * VoiceInput: the composer tool-row mic button. Toggles the browser's
 * SpeechRecognition (Web Speech API; Edge/Chrome) and appends each final
 * transcript to the draft through `inputActions.setDraft`, composing with
 * whatever is already typed. Unsupported browsers render nothing;
 * permission/network failures surface through the button's title and a
 * transient `data-error` state instead of a modal.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/** Full props of the composer mic button. */
export type VoiceInputProps = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS>;
/**
 * Render the composer mic button.
 * @param props - owner zone, the session standard kit (`useInput`,
 * `inputActions`), and the locale seat.
 * @returns the mic button, or null when speech recognition is unsupported.
 */
export declare function VoiceInput({ useInput, inputActions, t }: VoiceInputProps): import("react").JSX.Element | null;
//# sourceMappingURL=VoiceInput.d.ts.map