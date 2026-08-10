import type { UIMessage } from 'ai'

function isCompletePart(part: UIMessage['parts'][number]): boolean {
  if (part.type === 'text' || part.type === 'reasoning') return part.state !== 'streaming'
  if (part.type === 'dynamic-tool') {
    return part.state === 'output-available' || part.state === 'output-error'
  }
  if (part.type.startsWith('tool-') && 'state' in part) {
    return part.state === 'output-available' || part.state === 'output-error'
  }
  return true
}

/**
 * Keeps the largest valid conversation prefix after an interrupted request.
 * Completed tool calls/results remain available to the model; only the unfinished
 * suffix of the final assistant message is discarded.
 */
export function recoverConversationPrefix(messages: UIMessage[]): UIMessage[] {
  if (messages.length === 0) return []

  const last = messages[messages.length - 1]
  if (last.role !== 'assistant') return messages

  const incompleteIndex = last.parts.findIndex((part) => !isCompletePart(part))
  if (incompleteIndex === -1) return messages

  const completeParts = last.parts.slice(0, incompleteIndex)
  if (completeParts.length === 0) return messages.slice(0, -1)
  return [...messages.slice(0, -1), { ...last, parts: completeParts }]
}
