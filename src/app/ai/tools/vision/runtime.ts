import type { generateText } from 'ai'

import type { createAIModelRuntime } from '@/app/ai/models'

export type VisionModelDependencies = {
  createRuntime: typeof createAIModelRuntime
  inspect: typeof generateText
}
