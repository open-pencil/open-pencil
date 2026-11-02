import { generateId, type UIMessage } from 'ai'
import * as v from 'valibot'

import { messageMetadata } from '@/app/ai/chat/metadata'

/**
 * A compaction: the summary that stands for the conversation before it, whether the person or
 * the context filling up asked for it, and what the conversation held when it ran. One that ran
 * between a reply's steps is kept on the reply, with the step its kept part starts from.
 */
const compactionSchema = v.object({
  summary: v.string(),
  trigger: v.picklist(['manual', 'auto']),
  tokensBefore: v.nullable(v.number()),
  step: v.optional(v.number())
})

export type Compaction = v.InferOutput<typeof compactionSchema>

export function compactionOf(message: UIMessage): Compaction | null {
  const parsed = v.safeParse(compactionSchema, messageMetadata(message).compaction)
  return parsed.success ? parsed.output : null
}

/** What the model reads in place of the conversation a compaction summarized. */
export function summaryText(summary: string): string {
  return `The conversation so far, summarized when it was compacted:\n\n${summary}`
}

/**
 * The message a compaction adds to the conversation. The transcript draws it as a divider; the
 * model reads its text as the conversation so far, so a backend that knows nothing of
 * compaction still gets the summary.
 */
export function compactionMessage(compaction: Compaction, id = generateId()): UIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text: summaryText(compaction.summary) }],
    metadata: { compaction }
  }
}

/** Where the reply's `step`th step starts, each with a `step-start` part; its end past the last. */
function stepStart(reply: UIMessage, step: number): number {
  let seen = 0
  const at = reply.parts.findIndex((part) => part.type === 'step-start' && seen++ === step)
  return at === -1 ? reply.parts.length : at
}

/** The reply's parts from its `from`th step to before its `to`th, or to its end. */
export function replySteps(reply: UIMessage, from: number, to?: number): UIMessage['parts'] {
  return reply.parts.slice(
    stepStart(reply, from),
    to === undefined ? undefined : stepStart(reply, to)
  )
}

/** A compaction that ran between the reply's steps, and the step its kept part starts from. */
export function replyCompaction(message: UIMessage): (Compaction & { step: number }) | null {
  const compaction = message.role === 'assistant' ? compactionOf(message) : null
  return compaction?.step === undefined ? null : { ...compaction, step: compaction.step }
}

/**
 * The messages a model reads: from the latest compaction on, its summary standing for everything
 * before it, and for one that ran within a reply, the reply's steps after it. The person still
 * sees the whole conversation.
 */
export function messagesSinceCompaction(messages: readonly UIMessage[]): UIMessage[] {
  const at = messages.findLastIndex((message) => compactionOf(message) !== null)
  if (at === -1) return [...messages]
  const message = messages[at]
  const compaction = replyCompaction(message)
  if (!compaction) return messages.slice(at)
  return [
    compactionMessage(compaction, `${message.id}-summary`),
    { ...message, parts: replySteps(message, compaction.step) },
    ...messages.slice(at + 1)
  ]
}
