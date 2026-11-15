import type { LanguageModel } from 'ai'

import { fastTasksRuntime } from '@/app/ai/models/fast'

import { contextLimitsOf, type ContextLimits } from './limits'

/** A model that writes summaries, with the limits its summary request is sized for. */
export interface SummaryWriter {
  model: LanguageModel
  limits: ContextLimits | null
}

/**
 * Who writes a conversation's summaries: the Fast tasks model when it is an API model, else the
 * conversation's own. A summary request carries the conversation's messages, which a coding
 * agent's prompt cannot, so an agent on Fast tasks leaves summaries to the conversation's model.
 * A Fast tasks model whose catalog gives no window leaves them to the conversation's model too,
 * since a request sized for another model's window may not fit its own.
 */
export async function summaryWriter(
  conversation: SummaryWriter,
  fastTasks: typeof fastTasksRuntime = fastTasksRuntime,
  limitsOf: typeof contextLimitsOf = contextLimitsOf
): Promise<SummaryWriter> {
  const fast = await fastTasks()
  if (fast?.kind !== 'direct') return conversation
  const limits = await limitsOf(fast.role).catch(() => null)
  return limits ? { model: fast.model, limits } : conversation
}
