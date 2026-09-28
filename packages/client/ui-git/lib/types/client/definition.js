import { IconBranchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
/** The tab kind this package owns. */
export const GIT_KIND = 'git';
/** This implementation's identity in the tab system, and the key its body registers under. */
export const GIT_ID = '@dsh-custom/dsh-client-ui-git';
/**
 * The git type's registry definition.
 * @param t - namespace-bound translate, read fresh on every label call.
 * @returns the definition to register.
 */
export function gitDefinition(t) {
    return {
        id: GIT_ID,
        kind: GIT_KIND,
        priority: 'builtin',
        title: () => t('type.label'),
        guide: [{
                order: 20,
                title: () => t('guide.title'),
                description: () => t('guide.description'),
                icon: IconBranchOutline16,
            }],
    };
}
//# sourceMappingURL=definition.js.map