import type { UIMessage } from 'ai'
import dedent from 'dedent'
import * as v from 'valibot'

import { answersQuestions, askModel, type ModelAnswer } from '@/app/ai/models/ask'
import { fastTasksRuntime } from '@/app/ai/models/fast'
import { reviewOf } from '@/app/ai/review/message'

import { fallbackTitle } from './messages'

/** A title is a few words; the model is cut off well past that. */
const MAX_TITLE_TOKENS = 40
/** How much of the first reply the model reads to name the conversation. */
const REPLY_EXCERPT_LENGTH = 600

/** What naming a conversation reaches, which tests replace. */
export interface TitleDependencies {
  fastTasks: typeof fastTasksRuntime
  ask: typeof askModel
}

const DEFAULT_DEPENDENCIES: TitleDependencies = { fastTasks: fastTasksRuntime, ask: askModel }

/**
 * The title alone. An API model answers in this shape, which becomes the request's JSON schema,
 * so it holds only checks JSON Schema can express; an agent's answer is the title itself.
 */
export const TITLE_ANSWER: ModelAnswer<{ title: string }> = {
  schema: v.object({
    title: v.pipe(v.string(), v.minLength(1), v.description('At most six words'))
  }),
  name: 'conversation_title',
  fromText: (text) => ({ title: text })
}

function firstReply(messages: readonly UIMessage[]): string {
  // A design review is not the conversation's reply.
  const reply = messages.find((message) => message.role === 'assistant' && !reviewOf(message))
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
  { fastTasks, ask }: TitleDependencies = DEFAULT_DEPENDENCIES
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

    Reply with the title alone.
  `
  try {
    const { title } = await ask(runtime, {
      text,
      maxOutputTokens: MAX_TITLE_TOKENS,
      thinking: 'off',
      answer: TITLE_ANSWER
    })
    return title.trim() || null
  } catch {
    return null
  }
}
