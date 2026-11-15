import { generateId, type UIMessage } from 'ai'
import * as v from 'valibot'

import { messageMetadata } from '@/app/ai/chat/metadata'

/**
 * A compaction: the summary that stands for the conversation before it, whether the person or
 * the context filling up asked for it, and what the conversation held when it ran. An agent
 * that keeps its own context, such as Pi, compacts it there and may report no summary; its
 * compaction is only drawn, and the chat's own requests read past it.
 */
const compactionSchema = v.object({
  summary: v.string(),
  trigger: v.picklist(['manual', 'auto']),
  tokensBefore: v.nullable(v.number()),
  agent: v.optional(v.literal(true))
})

export type Compaction = v.InferOutput<typeof compactionSchema>

/**
 * Compactions that ran between a reply's steps, kept on the reply in the order they ran, each
 * with the step its kept part starts from. A long reply can compact more than once.
 */
const stepCompactionsSchema = v.array(v.object({ ...compactionSchema.entries, step: v.number() }))

export type StepCompaction = v.InferOutput<typeof stepCompactionsSchema>[number]

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

/** The divider for a compaction an agent ran in its own context and reported no summary of. */
export function agentCompactionMessage(trigger: Compaction['trigger']): UIMessage {
  const compaction: Compaction = { summary: '', trigger, tokensBefore: null, agent: true }
  return { id: generateId(), role: 'user', parts: [], metadata: { compaction } }
}

/** Whether the message is a compaction's summary, which a model reads. */
function summarizes(message: UIMessage): boolean {
  const compaction = compactionOf(message)
  return (compaction !== null && !compaction.agent) || replyCompactions(message).length > 0
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

/** The compactions that ran between the reply's steps, oldest first. */
export function replyCompactions(message: UIMessage): StepCompaction[] {
  if (message.role !== 'assistant') return []
  const parsed = v.safeParse(stepCompactionsSchema, messageMetadata(message).compactions)
  return parsed.success ? parsed.output : []
}

/**
 * The messages a model reads: from the latest compaction on, its summary standing for everything
 * before it, and for one that ran within a reply, the reply's steps after its latest. The person still
 * sees the whole conversation.
 */
export function messagesSinceCompaction(messages: readonly UIMessage[]): UIMessage[] {
  // An agent's own compaction holds nothing for a model to read.
  const read = messages.filter((message) => !compactionOf(message)?.agent)
  const at = read.findLastIndex(summarizes)
  if (at === -1) return read
  const message = read[at]
  const compaction = replyCompactions(message).at(-1)
  if (!compaction) return read.slice(at)
  return [
    compactionMessage(compaction, `${message.id}-summary`),
    { ...message, parts: replySteps(message, compaction.step) },
    ...read.slice(at + 1)
  ]
}
