import { createAIModelRuntime, type AIModelRuntime } from '@/app/ai/models/runtime'
import { aiModelSettings } from '@/app/ai/models/store'

/**
 * The model assigned to Fast tasks itself, for small work beside a chat: its title and its
 * compaction summaries. "Same as Design" and no model both give null, which leaves that work as
 * it is without a fast model, so nothing changes until a model is assigned. A fast model that
 * cannot be reached, as one whose key is gone, gives null as well: fast work never fails a chat.
 */
export async function fastTasksRuntime(
  createRuntime: typeof createAIModelRuntime = createAIModelRuntime
): Promise<AIModelRuntime | null> {
  const assignment = aiModelSettings.value.assignments.fast
  if (assignment === null || assignment === 'design') return null
  return createRuntime('fast').catch(() => null)
}
