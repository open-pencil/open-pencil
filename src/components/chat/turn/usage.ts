import type { useAIMessages } from '@open-pencil/vue/i18n'

import type { ReplyUsage } from '@/app/ai/chat/metadata'
import { formatCompactNumber } from '@/app/i18n/number'

/** A reply's tokens in and out, then the cached ones when there were any. */
export function usageParts(
  ai: ReturnType<typeof useAIMessages>['value'],
  usage: ReplyUsage
): string[] {
  const tokens = ai.replyTokens({
    input: formatCompactNumber(usage.inputTokens),
    output: formatCompactNumber(usage.outputTokens)
  })
  if (!usage.cacheReadTokens) return [tokens]
  return [tokens, ai.replyCachedTokens({ cached: formatCompactNumber(usage.cacheReadTokens) })]
}
