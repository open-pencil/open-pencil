import type { UIMessage } from 'ai'
import dedent from 'dedent'

import { answersQuestions, askModel } from '@/app/ai/models/ask'
import { fastTasksRuntime } from '@/app/ai/models/fast'

import { fallbackTitle } from './messages'

/** A title is a few words; the model is cut off well past that. */
const MAX_TITLE_TOKENS = 40
const MAX_TITLE_LENGTH = 80
/** How much of the first reply the model reads to name the conversation. */
const REPLY_EXCERPT_LENGTH = 600

/** What naming a conversation reaches, which tests replace. */
export interface TitleDependencies {
  fastTasks: typeof fastTasksRuntime
  ask: typeof askModel
}

const DEFAULT_DEPENDENCIES: TitleDependencies = { fastTasks: fastTasksRuntime, ask: askModel }

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

/** The model's answer as a title: its first line, without the quotes or full stop models add. */
function titleFrom(answer: string): string {
  const line = answer.trim().split('\n').at(0) ?? ''
  return line
    .replace(/^["'“‘«]+|["'”’»]+$/g, '')
    .replace(/\.$/, '')
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
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
    Write a title of at most six words for this design conversation. Use the language of the request. Reply with the title alone: no quotes, no full stop, nothing else.

    Request:
    ${request}

    Reply:
    ${reply}
  `
  const answer = await ask(runtime, { text, maxOutputTokens: MAX_TITLE_TOKENS }).catch(() => null)
  return (answer && titleFrom(answer)) || null
}
