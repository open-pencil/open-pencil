import { convertToModelMessages, generateText, type LanguageModel, type UIMessage } from 'ai'

import { messagesSinceCompaction } from './marker'
import prompt from './prompt.md?raw'

/** How much of one tool result the summary request keeps; the rest is what the design shows. */
const TOOL_OUTPUT_LIMIT = 4000

/** A tool result's text, cut to its start when it is long. */
function shortened(output: unknown): string {
  const text = typeof output === 'string' ? output : JSON.stringify(output)
  if (text.length <= TOOL_OUTPUT_LIMIT) return text
  return `${text.slice(0, TOOL_OUTPUT_LIMIT)}… (${text.length - TOOL_OUTPUT_LIMIT} more characters left out)`
}

/**
 * The conversation as the summary request reads it: no images or files, and long tool results
 * cut short, so a conversation too long for its model can still be summarized by it.
 */
export function summarySource(messages: readonly UIMessage[]): UIMessage[] {
  return messagesSinceCompaction(messages).map((message) => ({
    ...message,
    parts: message.parts.flatMap((part) => {
      if (part.type === 'file') return []
      if (part.type.startsWith('tool-') && 'state' in part && part.state === 'output-available') {
        return [{ ...part, output: shortened(part.output) }]
      }
      return [part]
    })
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
