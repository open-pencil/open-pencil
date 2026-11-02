import { convertToModelMessages, generateText, type LanguageModel, type UIMessage } from 'ai'

import { compactionOf, messagesSinceCompaction } from './marker'
import prompt from './prompt.md?raw'

/** How much of one tool's input or result the summary request keeps. */
const TOOL_LIMIT = 4000
/** How much of one message's text it keeps: a prompt pasted whole still leaves room. */
const TEXT_LIMIT = 16000

/** `value` as text, cut to its start when it is longer than `limit`. */
function shortened(value: unknown, limit: number): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}… (${text.length - limit} more characters left out)`
}

type Part = UIMessage['parts'][number]

function boundedPart(part: Part): Part[] {
  if (part.type === 'file') return []
  if (part.type === 'text') return [{ ...part, text: shortened(part.text, TEXT_LIMIT) }]
  if (!part.type.startsWith('tool-') || !('state' in part)) return [part]
  const input = 'input' in part ? { input: shortened(part.input, TOOL_LIMIT) } : {}
  const output =
    part.state === 'output-available' ? { output: shortened(part.output, TOOL_LIMIT) } : {}
  return [{ ...part, ...input, ...output } as Part]
}

/** How much of the conversation the summary request keeps, with no window known to fit. */
export const SUMMARY_BUDGET = 400_000

/**
 * The conversation as the summary request reads it: no images or files, long text, tool inputs,
 * and tool results cut short, and, past `budget` characters, the oldest messages left out but
 * the summary they follow, so a conversation too long for its model can still be summarized.
 */
export function summarySource(
  messages: readonly UIMessage[],
  budget = SUMMARY_BUDGET
): UIMessage[] {
  const bounded = messagesSinceCompaction(messages).map((message) => ({
    ...message,
    parts: message.parts.flatMap(boundedPart)
  }))
  const first = bounded.at(0)
  const earlier = first && compactionOf(first) ? [first] : []
  let left = budget - earlier.reduce((size, message) => size + JSON.stringify(message).length, 0)
  const kept: UIMessage[] = []
  for (const message of bounded.slice(earlier.length).reverse()) {
    left -= JSON.stringify(message).length
    if (left < 0 && kept.length > 0) break
    kept.unshift(message)
  }
  // With no summary before it, what is kept starts with a request, as providers expect.
  while (earlier.length === 0 && kept.length > 1 && kept[0].role !== 'user') kept.shift()
  return [...earlier, ...kept]
}

export interface SummaryOptions {
  model: LanguageModel
  messages: readonly UIMessage[]
  /** What the person asked the summary to keep or focus on. */
  instructions?: string
  /** How many characters of the conversation the request may carry. */
  budget?: number
  abortSignal?: AbortSignal
}

/** A summary of the conversation, written by the conversation's own model. */
export async function summarizeConversation({
  model,
  messages,
  instructions,
  budget,
  abortSignal
}: SummaryOptions): Promise<string> {
  const request = await convertToModelMessages(summarySource(messages, budget), {
    ignoreIncompleteToolCalls: true
  })
  const ask = instructions?.trim()
    ? `Summarize the conversation above. Also follow these instructions for the summary: ${instructions.trim()}`
    : 'Summarize the conversation above.'
  const { text } = await generateText({
    model,
    system: prompt.trim(),
    messages: [...request, { role: 'user', content: ask }],
    abortSignal
  })
  const summary = text.trim()
  if (!summary) throw new Error('The model wrote no summary')
  return summary
}
