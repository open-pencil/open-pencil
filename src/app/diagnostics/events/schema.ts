import * as v from 'valibot'

/** A model call's tokens; input counts cached tokens too, which the cache fields break out. */
export const tokenUsageSchema = v.object({
  inputTokens: v.nullable(v.number()),
  outputTokens: v.nullable(v.number()),
  cacheReadTokens: v.nullable(v.number()),
  cacheWriteTokens: v.nullable(v.number())
})
