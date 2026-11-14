import { valibotSchema } from '@ai-sdk/valibot'
import { generateText, Output, type UIMessage } from 'ai'
import dedent from 'dedent'
import * as v from 'valibot'

import { answersQuestions, askModel } from '@/app/ai/models/ask'
import { fastTasksRuntime } from '@/app/ai/models/fast'
import { runtimeReasoningSettings } from '@/app/ai/models/reasoning/settings'

import { fallbackTitle } from './messages'

/** A title is a few words; the model is cut off well past that. */
const MAX_TITLE_TOKENS = 40
/** How much of the first reply the model reads to name the conversation. */
const REPLY_EXCERPT_LENGTH = 600

/** What naming a conversation reaches, which tests replace. */
export interface TitleDependencies {
  fastTasks: typeof fastTasksRuntime
  /** Asks a coding agent, which answers in text. */
  ask: typeof askModel
  /** Calls an API model, which answers in the title's shape. */
  generate: typeof generateText
}

const DEFAULT_DEPENDENCIES: TitleDependencies = {
  fastTasks: fastTasksRuntime,
  ask: askModel,
  generate: generateText
}

/**
 * What an API model answers: the title alone. It becomes the request's JSON schema, so it holds
 * only checks JSON Schema can express.
 */
const titleSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1), v.description('At most six words'))
})

function firstReply(messages: readonly UIMessage[]): string {
  const reply = messages.find((message) => message.role === 'assistant')
  return (reply?.parts ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, REPLY_EXCERPT_LENGTH)
}

/**
 * A short title for a conversation, written by the Fast tasks model from its first request and
 * reply. Null when no model is assigned to Fast tasks, the model cannot be asked, or it fails:
 * the conversation then keeps the title taken from its first message.
 */
export async function conversationTitle(
  messages: UIMessage[],
  { fastTasks, ask, generate }: TitleDependencies = DEFAULT_DEPENDENCIES
): Promise<string | null> {
  const request = fallbackTitle(messages)
  const reply = firstReply(messages)
  if (!request || !reply) return null
  const runtime = await fastTasks()
  if (!runtime || !answersQuestions(runtime)) return null
  const text = dedent`
    Write a title of at most six words for this design conversation, in the language of the request.

    Request:
    ${request}

    Reply:
    ${reply}
  `
  try {
    if (runtime.kind === 'direct') {
      const { output } = await generate({
        model: runtime.model,
        maxOutputTokens: Math.min(runtime.role.profile.maxOutputTokens, MAX_TITLE_TOKENS),
        ...runtimeReasoningSettings(runtime),
        output: Output.object({ schema: valibotSchema(titleSchema), name: 'conversation_title' }),
        prompt: text
      })
      return output.title.trim() || null
    }
    // An agent answers over ACP in text alone, so it is asked for the title and nothing else.
    const answer = await ask(runtime, { text: `${text}\n\nReply with the title alone.` })
    return answer.trim() || null
  } catch {
    return null
  }
}
