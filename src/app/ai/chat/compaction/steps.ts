import type { LanguageModel, LanguageModelUsage, ModelMessage, UIMessage } from 'ai'

import { compactAutomatically } from '@/app/ai/chat/preferences'
import { createDeferred } from '@/app/runtime/deferred'

import { autoCompactAt, designContextLimits, summaryBudget, type ContextLimits } from './limits'
import { compactionOf, summaryText, type StepCompaction } from './marker'
import { summaryWriter, type SummaryWriter } from './model'
import { summarizeModelMessages } from './summarize'

/** What `work` gives, or null when the reply is stopped first: a stalled lookup must not hold it open. */
async function unlessStopped<T>(
  work: Promise<T>,
  signal: AbortSignal | undefined
): Promise<T | null> {
  if (!signal) return work
  if (signal.aborted) return null
  const stopped = createDeferred<null>()
  const stop = () => stopped.resolve(null)
  signal.addEventListener('abort', stop, { once: true })
  try {
    return await Promise.race([work, stopped.promise])
  } finally {
    signal.removeEventListener('abort', stop)
  }
}

interface StepState {
  stepNumber: number
  steps: readonly { usage: LanguageModelUsage }[]
  messages: ModelMessage[]
}

/**
 * Compaction between the steps of one reply, for a long run whose requests fill the context
 * before it ends. The last step's call and results stay for the model to go on from, and
 * everything before them becomes a summary. The reply records where it was compacted, which
 * the transcript draws and later requests start from.
 */
export function createStepCompaction(
  model: LanguageModel,
  contextLimits: () => Promise<ContextLimits | null> = designContextLimits,
  /** Who writes the summaries, given the reply's own model and limits. */
  summaryWriterFor: (conversation: SummaryWriter) => Promise<SummaryWriter> = summaryWriter
) {
  let limits: ContextLimits | null = null
  let abortSignal: AbortSignal | undefined
  let summaryFirst = false
  /** The reply's compactions so far; the metadata carries the whole list, which replaces the last. */
  let compactions: StepCompaction[] = []
  /** Whether the reply has yet to record the latest; it goes with the next step's start. */
  let unrecorded = false

  /** Before a reply: whether it may compact, read once, and what its request starts with. */
  async function begin(sent: readonly UIMessage[], signal: AbortSignal | undefined) {
    limits = compactAutomatically.value
      ? await unlessStopped(
          contextLimits().catch(() => null),
          signal
        )
      : null
    abortSignal = signal
    const first = sent.at(0)
    summaryFirst = first !== undefined && compactionOf(first) !== null
    compactions = []
    unrecorded = false
  }

  /** The step's messages, compacted when the last step's request passed the threshold. */
  async function prepareStep({ stepNumber, steps, messages }: StepState) {
    const usage = steps.at(-1)?.usage
    if (!limits || stepNumber === 0 || usage?.inputTokens === undefined) return undefined
    const held = usage.inputTokens + (usage.outputTokens ?? 0)
    if (held < autoCompactAt(limits)) return undefined
    const last = messages.findLastIndex((message) => message.role === 'assistant')
    if (last <= 0) return undefined
    let summary: string
    try {
      // The request is sized for the model that writes it, whose window may be the smaller.
      const writer = await unlessStopped(summaryWriterFor({ model, limits }), abortSignal)
      if (!writer) return undefined
      summary = await summarizeModelMessages(messages.slice(0, last), {
        model: writer.model,
        summaryFirst,
        budget: writer.limits ? summaryBudget(writer.limits) : undefined,
        abortSignal
      })
    } catch {
      // The step goes on uncompacted; a request that then overflows fails as any other would.
      return undefined
    }
    summaryFirst = true
    compactions = [
      ...compactions,
      { summary, trigger: 'auto', tokensBefore: held, step: stepNumber - 1 }
    ]
    unrecorded = true
    return {
      messages: [
        // Shaped as the summary message converts, so a saved trace rebuilds this request.
        {
          role: 'user',
          content: [{ type: 'text', text: summaryText(summary) }]
        } satisfies ModelMessage,
        ...messages.slice(last)
      ]
    }
  }

  /** The reply's metadata at a step's start, carrying a compaction made before it. */
  function metadataFor(part: { type: string }) {
    if (part.type !== 'start-step' || !unrecorded) return undefined
    unrecorded = false
    return { compactions }
  }

  return { begin, prepareStep, metadataFor }
}
