import type { AIProviderID } from '@lawha/core/constants'

/**
 * The provider whose models a Cloud workspace's plan pays for, through the AI service the Home
 * server advertises. Its catalog, not the provider definition, names the models.
 */
export const LAWHA_AI_PROVIDER = 'lawha' as const satisfies AIProviderID
