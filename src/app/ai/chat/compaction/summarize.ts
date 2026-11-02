import { convertToModelMessages, generateText } from 'ai'
import type { LanguageModel, ModelMessage, UIMessage } from 'ai'

import { compactionOf, messagesSinceCompaction } from './marker'
import prompt from './prompt.md?raw'

/** How much of one tool's input or result the summary request keeps. */
const TOOL_LIMIT = 4000
/** How much of one message's text it keeps: a prompt pasted whole still leaves room. */
const TEXT_LIMIT = 16000
/** How much of the conversation the summary request keeps, with no window known to fit. */
export const SUMMARY_BUDGET = 400_000

/** `value` as text, cut to its start when it is longer than `limit`. */
function shortened(value: unknown, limit: number): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}… (${text.length - limit} more characters left out)`
}

type ContentPart = Exclude<ModelMessage['content'], string>[number]

/** The part as the summary reads it: no images or files, long text and tool data cut short. */
function boundedPart(part: ContentPart): ContentPart[] {
  switch (part.type) {
    case 'image':
    case 'file':
      return []
    case 'text':
    case 'reasoning':
      return [{ ...part, text: shortened(part.text, TEXT_LIMIT) }]
    case 'tool-call':
      return [{ ...part, input: shortened(part.input, TOOL_LIMIT) }]
    case 'tool-result': {
      // A result's images are left out, as a message's are; its text stays.
      const output =
        part.output.type === 'content'
          ? { ...part.output, value: part.output.value.filter((item) => item.type === 'text') }
          : part.output
      if (JSON.stringify(output).length <= TOOL_LIMIT) return [{ ...part, output }]
      const value = output.type === 'text' || output.type === 'json' ? output.value : output
      return [{ ...part, output: { type: 'text', value: shortened(value, TOOL_LIMIT) } }]
    }
    default:
      return [part]
  }
}

function boundedMessage(message: ModelMessage): ModelMessage {
  if (typeof message.content === 'string')
    return { ...message, content: shortened(message.content, TEXT_LIMIT) } as ModelMessage
  return { ...message, content: message.content.flatMap(boundedPart) } as ModelMessage
}

/**
 * The conversation as the summary request reads it: no images or files, long text, tool inputs,
 * and tool results cut short, and, past `budget` characters, the oldest messages left out but
 * the summary they follow, so a conversation too long for its model can still be summarized.
 * `summaryFirst` says the first message is an earlier compaction's summary.
 */
export function summarySource(
  messages: readonly ModelMessage[],
  { summaryFirst = false, budget = SUMMARY_BUDGET } = {}
): ModelMessage[] {
  const bounded = messages.map(boundedMessage)
  const earlier = summaryFirst ? bounded.slice(0, 1) : []
  let left = budget - earlier.reduce((size, message) => size + JSON.stringify(message).length, 0)
  const kept: ModelMessage[] = []
  for (const message of bounded.slice(earlier.length).reverse()) {
    left -= JSON.stringify(message).length
    if (left < 0 && kept.length > 0) break
    kept.unshift(message)
  }
  // What is kept starts with a request, as providers expect, and never with a tool result
  // whose call was left out.
  while (earlier.length === 0 && kept.length > 1 && kept[0].role !== 'user') kept.shift()
  while (kept[0]?.role === 'tool') kept.shift()
  return [...earlier, ...kept]
}

export interface SummaryOptions {
  model: LanguageModel
  /** What the person asked the summary to keep or focus on. */
  instructions?: string
  /** How many characters of the conversation the request may carry. */
  budget?: number
  abortSignal?: AbortSignal
}

/**
 * A summary of `messages`, as the model reads them, written by the conversation's own model.
 * Between a reply's steps the conversation is already model messages.
 */
export async function summarizeModelMessages(
  messages: readonly ModelMessage[],
  {
    model,
    instructions,
    budget,
    abortSignal,
    summaryFirst
  }: SummaryOptions & {
    summaryFirst: boolean
  }
): Promise<string> {
  const ask = instructions?.trim()
    ? `Summarize the conversation above. Also follow these instructions for the summary: ${instructions.trim()}`
    : 'Summarize the conversation above.'
  const { text } = await generateText({
    model,
    system: prompt.trim(),
    messages: [
      ...summarySource(messages, { summaryFirst, budget }),
      { role: 'user', content: ask }
    ],
    abortSignal
  })
  const summary = text.trim()
  if (!summary) throw new Error('The model wrote no summary')
  return summary
}

/** A summary of the conversation, from its latest compaction on. */
export async function summarizeConversation(
  messages: readonly UIMessage[],
  options: SummaryOptions
): Promise<string> {
  const since = messagesSinceCompaction(messages)
  // Images and files are left out before conversion, which would otherwise inline them.
  const textual = since.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => part.type !== 'file')
  }))
  const request = await convertToModelMessages(textual, { ignoreIncompleteToolCalls: true })
  const first = since.at(0)
  return summarizeModelMessages(request, {
    ...options,
    summaryFirst: first !== undefined && compactionOf(first) !== null
  })
}
