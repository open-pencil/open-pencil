import { generateText } from 'ai'

import type { askAgent } from '@/app/ai/agents/acp/oneoff'
import { runtimeReasoningSettings } from '@/app/ai/models/reasoning/settings'
import type { AIModelRuntime } from '@/app/ai/models/runtime'

/** One question for a role's model: text and images in, text out, with none of OpenPencil's tools. */
export interface ModelQuestion {
  text: string
  images?: ReadonlyArray<{ mediaType: string; data: Uint8Array }>
  /** The most an API model may answer with; its profile's limit still applies. */
  maxOutputTokens?: number
  signal?: AbortSignal
}

/** What asking reaches outside the app, which tests replace. */
export interface ModelAskDependencies {
  generate?: typeof generateText
  askAgent?: typeof askAgent
}

/** The role's model takes no question of this kind, as Pi, whose companion only runs chat turns. */
export class ModelQuestionUnsupportedError extends Error {
  constructor() {
    super('This model cannot be asked a question outside a chat.')
    this.name = 'ModelQuestionUnsupportedError'
  }
}

/** Whether `askModel` can put a question to the runtime's model. */
export function answersQuestions(runtime: AIModelRuntime): boolean {
  return runtime.kind !== 'harness'
}

/**
 * Asks a role's model one question, however the model is reached: an API model is called
 * directly, and an ACP agent is started for the question in a session of its own, on the model
 * its profile names. Whatever holds a role is asked this way, so a role's work does not depend
 * on the kind of model that holds it.
 */
export async function askModel(
  runtime: AIModelRuntime,
  { text, images = [], maxOutputTokens, signal }: ModelQuestion,
  { generate = generateText, askAgent: ask }: ModelAskDependencies = {}
): Promise<string> {
  if (runtime.kind === 'acp') {
    // Starting agents loads with the first question for one, not with the tools that ask.
    const start = ask ?? (await import('@/app/ai/agents/acp/oneoff')).askAgent
    return start(runtime.agent, { text, images, model: runtime.model, signal })
  }
  if (runtime.kind === 'harness') throw new ModelQuestionUnsupportedError()
  const limit = runtime.role.profile.maxOutputTokens
  const result = await generate({
    model: runtime.model,
    maxOutputTokens: maxOutputTokens === undefined ? limit : Math.min(limit, maxOutputTokens),
    ...runtimeReasoningSettings(runtime),
    abortSignal: signal,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text },
          ...images.map((image) => ({ type: 'file' as const, ...image }))
        ]
      }
    ]
  })
  return result.text
}
