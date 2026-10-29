import type { AIProviderID } from '@open-pencil/core/constants'

/**
 * The provider whose models a Cloud workspace's plan pays for, through the AI service the Home
 * server advertises. Its catalog, not the provider definition, names the models.
 */
export const OPENPENCIL_AI_PROVIDER = 'openpencil' as const satisfies AIProviderID
