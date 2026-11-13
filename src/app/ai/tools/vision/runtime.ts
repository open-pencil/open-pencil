import type { generateText } from 'ai'

import type { askAgent } from '@/app/ai/agents/acp/oneoff'
import type { createAIModelRuntime } from '@/app/ai/models'

/** What asking the Vision model reaches, which tests replace. */
export type VisionModelDependencies = {
  createRuntime: typeof createAIModelRuntime
  /** Calls an API model. */
  inspect: typeof generateText
  /** Asks a coding agent that holds Vision. */
  askAgent?: typeof askAgent
}
