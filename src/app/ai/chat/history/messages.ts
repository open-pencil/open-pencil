import { isToolUIPart, type UIMessage } from 'ai'
import { toRaw } from 'vue'

import {
  attachmentsForMessage,
  setMessageAttachments
} from '@/app/ai/attachment/presentation/store'
import { visibleMessageText, setVisibleMessageText } from '@/app/ai/chat/presentation'
import { readToolChange, setToolChange } from '@/app/ai/tools/changes/store'

import type { ConversationMessage } from './types'

export function snapshotMessages(messages: UIMessage[]): ConversationMessage[] {
  return messages.map((message) => {
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    return {
      message: structuredClone(toRaw(message)),
      displayText: visibleMessageText(message.id, text),
      attachments: attachmentsForMessage(message.id).value.map((attachment) =>
        structuredClone(toRaw(attachment))
      ),
      toolChanges: message.parts.flatMap((part) => {
        const change = isToolUIPart(part) ? readToolChange(part.toolCallId) : null
        return change ? [structuredClone(toRaw(change))] : []
      })
    }
  })
}

export function restoreMessages(messages: ConversationMessage[]): UIMessage[] {
  for (const row of messages) {
    if (row.displayText !== undefined) setVisibleMessageText(row.message.id, row.displayText)
    setMessageAttachments(row.message.id, row.attachments)
    for (const change of row.toolChanges ?? []) setToolChange(change)
  }
  return messages.map((row) => structuredClone(row.message))
}

export function fallbackTitle(messages: UIMessage[]): string {
  const first = messages.find((message) => message.role === 'user')
  if (!first) return ''
  const text = first.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
  return visibleMessageText(first.id, text).replace(/\s+/g, ' ').trim().slice(0, 120)
}
