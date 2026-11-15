import { valibotSchema } from '@ai-sdk/valibot'
import { generateText, Output } from 'ai'
import type * as v from 'valibot'

import type { askAgent } from '@/app/ai/agents/acp/oneoff'
import { reasoningCallSettings, runtimeReasoningSettings } from '@/app/ai/models/reasoning/settings'
import type { AIModelRuntime, DirectAIModelRuntime } from '@/app/ai/models/runtime'

/** One question for a role's model: text and images in, text out, with none of OpenPencil's tools. */
export interface ModelQuestion {
  text: string
  images?: ReadonlyArray<{ mediaType: string; data: Uint8Array }>
  /** The most an API model may answer with; its profile's limit still applies. */
  maxOutputTokens?: number
  /**
   * `off` asks an API model not to think, for an answer of a few words. A model that always
   * thinks thinks the least it can, and keeps its profile's limit to think in.
   */
  thinking?: 'off'
  signal?: AbortSignal
}

/**
 * The shape an answer takes. An API model answers in it as structured output; an agent answers
 * over ACP in text alone, which `fromText` turns into it.
 */
export interface ModelAnswer<T> {
  schema: v.GenericSchema<unknown, T>
  /** The structured output's name, for providers that take one. */
  name: string
  fromText: (text: string) => T
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

/** The output limit and thinking an API model is asked with. */
function callSettings(runtime: DirectAIModelRuntime, { maxOutputTokens, thinking }: ModelQuestion) {
  const { connection, profile } = runtime.role
  const thinksAnyway = thinking === 'off' && runtime.minReasoningEffort !== undefined
  return {
    maxOutputTokens:
      maxOutputTokens === undefined || thinksAnyway
        ? profile.maxOutputTokens
        : Math.min(profile.maxOutputTokens, maxOutputTokens),
    ...(thinking === 'off'
      ? reasoningCallSettings(connection.providerID, 'off', runtime.minReasoningEffort)
      : runtimeReasoningSettings(runtime))
  }
}

/**
 * Asks a role's model one question, however the model is reached: an API model is called
 * directly, and an ACP agent is started for the question in a session of its own, on the model
 * its profile names. Whatever holds a role is asked this way, so a role's work does not depend
 * on the kind of model that holds it. Given an answer's shape, the answer comes in that shape.
 */
export async function askModel(
  runtime: AIModelRuntime,
  question: ModelQuestion,
  dependencies?: ModelAskDependencies
): Promise<string>
export async function askModel<T>(
  runtime: AIModelRuntime,
  question: ModelQuestion & { answer: ModelAnswer<T> },
  dependencies?: ModelAskDependencies
): Promise<T>
export async function askModel<T>(
  runtime: AIModelRuntime,
  question: ModelQuestion & { answer?: ModelAnswer<T> },
  { generate = generateText, askAgent: ask }: ModelAskDependencies = {}
): Promise<string | T> {
  const { text, images = [], signal, answer } = question
  if (runtime.kind === 'acp') {
    // Starting agents loads with the first question for one, not with the tools that ask.
    const start = ask ?? (await import('@/app/ai/agents/acp/oneoff')).askAgent
    const reply = await start(runtime.agent, { text, images, model: runtime.model, signal })
    return answer ? answer.fromText(reply) : reply
  }
  if (runtime.kind === 'harness') throw new ModelQuestionUnsupportedError()
  const request = {
    model: runtime.model,
    ...callSettings(runtime, question),
    abortSignal: signal,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text },
          ...images.map((image) => ({ type: 'file' as const, ...image }))
        ]
      }
    ]
  }
  if (!answer) return (await generate(request)).text
  const { output } = await generate({
    ...request,
    output: Output.object({ schema: valibotSchema(answer.schema), name: answer.name })
  })
  return output
}
