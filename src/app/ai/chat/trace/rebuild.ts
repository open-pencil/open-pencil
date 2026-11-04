import { convertToModelMessages } from 'ai'
import type { ModelMessage, ToolSet, UIMessage } from 'ai'

import {
  compactionMessage,
  messagesSinceCompaction,
  replyCompactions,
  replySteps
} from '@/app/ai/chat/compaction/marker'
import { requestMessages } from '@/app/ai/chat/history/continuation'

import { fingerprint } from './fingerprint'
import type { RunTrace } from './types'

/**
 * The messages a run's `step` sent to the model, rebuilt from the conversation: what the run
 * sent, as `requestMessages` and compaction prepared it, then the reply's earlier steps. After
 * a compaction within the reply, the request starts again from the latest summary before it.
 */
export async function rebuildStepMessages(
  conversation: UIMessage[],
  run: Pick<RunTrace, 'input'>,
  step: number,
  tools: ToolSet
): Promise<ModelMessage[]> {
  const through = conversation.findIndex((message) => message.id === run.input.through)
  const sent = messagesSinceCompaction(requestMessages(conversation.slice(0, through + 1)))
  const reply = conversation.at(through + 1)
  if (reply?.role !== 'assistant' || step === 0) return convertToModelMessages(sent, { tools })
  const resumed = replyCompactions(reply).findLast((compaction) => compaction.step < step)
  const earlier = { ...reply, parts: replySteps(reply, resumed?.step ?? 0, step) }
  const before = resumed ? [compactionMessage(resumed, `${reply.id}-summary`)] : sent
  return convertToModelMessages(earlier.parts.length > 0 ? [...before, earlier] : before, {
    tools
  })
}

/** Whether the rebuilt request of a run's step is the one the model received. */
export async function matchesRecordedStep(
  conversation: UIMessage[],
  run: RunTrace,
  step: number,
  tools: ToolSet
): Promise<boolean> {
  const recorded = run.steps.find((entry) => entry.index === step)
  if (!recorded) return false
  const rebuilt = await rebuildStepMessages(conversation, run, step, tools)
  return (await fingerprint(rebuilt)) === recorded.request.hash
}
