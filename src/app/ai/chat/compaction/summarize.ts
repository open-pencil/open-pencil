import { convertToModelMessages, generateText } from 'ai'
import type { LanguageModel, ModelMessage, UIMessage } from 'ai'

import { isContextLimitError } from '@/app/ai/chat/failure'

import { compactionOf, messagesSinceCompaction } from './marker'
import prompt from './prompt.md?raw'

/** How much of one tool's input or result the summary request keeps. */
const TOOL_LIMIT = 4000
/** How much of one message's text it keeps: a prompt pasted whole still leaves room. */
const TEXT_LIMIT = 16000
/** How much of the conversation the summary request keeps, with no window known to fit. */
export const SUMMARY_BUDGET = 400_000
/**
 * The budget is counted at about four characters a token; text as dense as one a token, such as
 * Chinese or Japanese, can still overflow, and the request is tried again with a quarter of it.
 */
const DENSE_TEXT_RETRY = 4

/** `value` as text, cut to its start when it is longer than `limit`. */
function shortened(value: unknown, limit: number): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}… (${text.length - limit} more characters left out)`
}

type ContentPart = Exclude<ModelMessage['content'], string>[number]

/** How much of one message's text, and of one tool's input or result, the summary keeps. */
interface PartLimits {
  text: number
  tool: number
}

const PART_LIMITS: PartLimits = { text: TEXT_LIMIT, tool: TOOL_LIMIT }

/** The shortest a part is cut to, so a message too long for the budget still says something. */
const SHORTEST_PART = 200

/** The part as the summary reads it: no images or files, long text and tool data cut short. */
function boundedPart(part: ContentPart, limits: PartLimits): ContentPart[] {
  switch (part.type) {
    case 'image':
    case 'file':
      return []
    case 'text':
    case 'reasoning':
      return [{ ...part, text: shortened(part.text, limits.text) }]
    case 'tool-call':
      return [{ ...part, input: shortened(part.input, limits.tool) }]
    case 'tool-result': {
      // A result's images are left out, as a message's are; its text stays.
      const output =
        part.output.type === 'content'
          ? { ...part.output, value: part.output.value.filter((item) => item.type === 'text') }
          : part.output
      if (JSON.stringify(output).length <= limits.tool) return [{ ...part, output }]
      const value = output.type === 'text' || output.type === 'json' ? output.value : output
      return [{ ...part, output: { type: 'text', value: shortened(value, limits.tool) } }]
    }
    default:
      return [part]
  }
}

function boundedMessage(message: ModelMessage, limits = PART_LIMITS): ModelMessage {
  if (typeof message.content === 'string')
    return { ...message, content: shortened(message.content, limits.text) } as ModelMessage
  return {
    ...message,
    content: message.content.flatMap((part) => boundedPart(part, limits))
  } as ModelMessage
}

const size = (message: ModelMessage) => JSON.stringify(message).length

/** The message cut shorter, part by part, until it fits `budget` or its parts are at their shortest. */
function fitted(message: ModelMessage, budget: number): ModelMessage {
  let limits = PART_LIMITS
  let bounded = boundedMessage(message, limits)
  while (size(bounded) > budget && limits.tool > SHORTEST_PART) {
    limits = {
      text: Math.max(SHORTEST_PART, Math.floor(limits.text / 2)),
      tool: Math.max(SHORTEST_PART, Math.floor(limits.tool / 2))
    }
    bounded = boundedMessage(message, limits)
  }
  return bounded
}

/**
 * The conversation as the summary request reads it: no images or files, long text, tool inputs,
 * and tool results cut short, and, past `budget` characters, the oldest messages left out but
 * the summary they follow and the newest cut to fit, so a conversation too long for its model
 * can still be summarized.
 * `summaryFirst` says the first message is an earlier compaction's summary.
 */
export function summarySource(
  messages: readonly ModelMessage[],
  { summaryFirst = false, budget = SUMMARY_BUDGET } = {}
): ModelMessage[] {
  const earlier = summaryFirst ? messages.slice(0, 1).map((message) => boundedMessage(message)) : []
  let left = budget - earlier.reduce((total, message) => total + size(message), 0)
  const kept: ModelMessage[] = []
  for (const message of messages.slice(earlier.length).toReversed()) {
    // The newest message stays even past the budget, cut shorter to fit what is left.
    const bounded = kept.length === 0 ? fitted(message, left) : boundedMessage(message)
    left -= size(bounded)
    if (left < 0 && kept.length > 0) break
    kept.unshift(bounded)
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
    budget = SUMMARY_BUDGET,
    abortSignal,
    summaryFirst
  }: SummaryOptions & {
    summaryFirst: boolean
  }
): Promise<string> {
  const ask = instructions?.trim()
    ? `Summarize the conversation above. Also follow these instructions for the summary: ${instructions.trim()}`
    : 'Summarize the conversation above.'
  const request = (within: number) =>
    generateText({
      model,
      system: prompt.trim(),
      messages: [
        ...summarySource(messages, { summaryFirst, budget: within }),
        { role: 'user', content: ask }
      ],
      abortSignal
    })
  const result = await request(budget).catch((error: unknown) => {
    if (!isContextLimitError(error)) throw error
    return request(Math.floor(budget / DENSE_TEXT_RETRY))
  })
  const summary = result.text.trim()
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
