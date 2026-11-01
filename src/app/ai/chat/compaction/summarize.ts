import { convertToModelMessages, generateText, type LanguageModel, type UIMessage } from 'ai'

import { messagesSinceCompaction } from './marker'
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

/**
 * The conversation as the summary request reads it: no images or files, and long text, tool
 * inputs, and tool results cut short, so a conversation too long for its model, even one whose
 * last prompt alone was, can still be summarized by it.
 */
export function summarySource(messages: readonly UIMessage[]): UIMessage[] {
  return messagesSinceCompaction(messages).map((message) => ({
    ...message,
    parts: message.parts.flatMap(boundedPart)
  }))
}

export interface SummaryOptions {
  model: LanguageModel
  messages: readonly UIMessage[]
  /** What the person asked the summary to keep or focus on. */
  instructions?: string
  abortSignal?: AbortSignal
}

/** A summary of the conversation, written by the conversation's own model. */
export async function summarizeConversation({
  model,
  messages,
  instructions,
  abortSignal
}: SummaryOptions): Promise<string> {
  const request = await convertToModelMessages(summarySource(messages), {
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
