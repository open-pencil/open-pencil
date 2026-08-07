import type { UIMessage } from 'ai'

export function chatPartKey(part: UIMessage['parts'][number], index: number): string {
  if ('toolCallId' in part) return part.toolCallId
  return `part-${index}`
}

export function removeMessageFromHistory(messages: UIMessage[], messageId: string): UIMessage[] {
  return messages.filter((message) => message.id !== messageId)
}

export function removePartFromHistory(
  messages: UIMessage[],
  messageId: string,
  partKey: string
): UIMessage[] {
  return messages.flatMap((message) => {
    if (message.id !== messageId) return [message]

    const parts = message.parts.filter((part, index) => chatPartKey(part, index) !== partKey)
    if (parts.length === 0) return []
    return [{ ...message, parts }]
  })
}
