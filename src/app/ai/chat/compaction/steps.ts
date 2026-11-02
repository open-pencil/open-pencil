import type { LanguageModel, LanguageModelUsage, ModelMessage, UIMessage } from 'ai'

import { compactAutomatically } from '@/app/ai/chat/preferences'

import { autoCompactAt, designContextLimits, summaryBudget, type ContextLimits } from './limits'
import { compactionOf, summaryText, type Compaction } from './marker'
import { summarizeModelMessages } from './summarize'

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
  contextLimits: () => Promise<ContextLimits | null> = designContextLimits
) {
  let limits: ContextLimits | null = null
  let abortSignal: AbortSignal | undefined
  let summaryFirst = false
  /** A compaction the reply has not recorded yet; it goes with the next step's start. */
  let unrecorded: Compaction | null = null

  /** Before a reply: whether it may compact, read once, and what its request starts with. */
  async function begin(sent: readonly UIMessage[], signal: AbortSignal | undefined) {
    limits = compactAutomatically.value ? await contextLimits().catch(() => null) : null
    abortSignal = signal
    const first = sent.at(0)
    summaryFirst = first !== undefined && compactionOf(first) !== null
    unrecorded = null
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
      summary = await summarizeModelMessages(messages.slice(0, last), {
        model,
        summaryFirst,
        budget: summaryBudget(limits),
        abortSignal
      })
    } catch {
      // The step goes on uncompacted; a request that then overflows fails as any other would.
      return undefined
    }
    summaryFirst = true
    unrecorded = { summary, trigger: 'auto', tokensBefore: held, step: stepNumber - 1 }
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
    const compaction = unrecorded
    unrecorded = null
    return { compaction }
  }

  return { begin, prepareStep, metadataFor }
}
