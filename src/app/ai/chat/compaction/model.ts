import type { LanguageModel } from 'ai'

import { fastTasksRuntime } from '@/app/ai/models/fast'

/**
 * The model that writes a conversation's summaries: the Fast tasks model when it is an API model,
 * else the conversation's own. A summary request carries the conversation's messages, which a
 * coding agent's prompt cannot, so an agent on Fast tasks leaves summaries to the conversation's
 * model.
 */
export async function summaryModel(
  conversationModel: LanguageModel,
  fastTasks: typeof fastTasksRuntime = fastTasksRuntime
): Promise<LanguageModel> {
  const fast = await fastTasks()
  return fast?.kind === 'direct' ? fast.model : conversationModel
}
