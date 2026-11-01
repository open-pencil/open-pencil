import { generateId, type UIMessage } from 'ai'
import * as v from 'valibot'

import { messageMetadata } from '@/app/ai/chat/metadata'

/**
 * A compaction: the summary that stands for the conversation before it, whether the person or
 * the context filling up asked for it, and what the conversation held when it ran.
 */
const compactionSchema = v.object({
  summary: v.string(),
  trigger: v.picklist(['manual', 'auto']),
  tokensBefore: v.nullable(v.number())
})

export type Compaction = v.InferOutput<typeof compactionSchema>

export function compactionOf(message: UIMessage): Compaction | null {
  const parsed = v.safeParse(compactionSchema, messageMetadata(message).compaction)
  return parsed.success ? parsed.output : null
}

/**
 * The message a compaction adds to the conversation. The transcript draws it as a divider; the
 * model reads its text as the conversation so far, so a backend that knows nothing of
 * compaction still gets the summary.
 */
export function compactionMessage(compaction: Compaction): UIMessage {
  return {
    id: generateId(),
    role: 'user',
    parts: [
      {
        type: 'text',
        text: `The conversation so far, summarized when it was compacted:\n\n${compaction.summary}`
      }
    ],
    metadata: { compaction }
  }
}

/**
 * The messages a model reads: from the latest compaction on, its summary standing for everything
 * before it. The person still sees the whole conversation.
 */
export function messagesSinceCompaction<T extends UIMessage>(messages: readonly T[]): T[] {
  const at = messages.findLastIndex((message) => compactionOf(message) !== null)
  return at === -1 ? [...messages] : messages.slice(at)
}
