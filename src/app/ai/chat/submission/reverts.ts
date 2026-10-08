import { tryOnScopeDispose } from '@vueuse/core'
import type { UIMessage } from 'ai'
import { toRaw, type Ref } from 'vue'

import { appendRevertedTurnContext } from '@/app/ai/chat/context'
import type { ChatInstance } from '@/app/ai/chat/submission/types'
import {
  onTurnRestored,
  revertsToReport,
  revertTurn,
  withRevert,
  type Revert
} from '@/app/ai/chat/turns'

interface RevertRecordOptions {
  chat: Ref<ChatInstance | null>
  flush?: () => Promise<void>
}

/**
 * Keeps reverted replies marked in the chat and tells the model about them: a revert marks
 * the reply, the next request carries a note for each revert no request has reported yet, and
 * Redo bringing the edits back removes the mark.
 */
export function useRevertRecords(options: RevertRecordOptions) {
  function mark(chat: ChatInstance, ids: readonly string[], revert: Revert | null): void {
    if (ids.length === 0) return
    const marked = new Set(ids)
    // The chat's messages are reactive; a copy of one would carry its proxied parts, which
    // saving the conversation cannot clone.
    chat.messages = chat.messages.map((message) =>
      marked.has(message.id) ? withRevert(toRaw(message), revert) : message
    )
  }

  const stopRestored = onTurnRestored((messageId) => {
    const chat = options.chat.value
    if (!chat?.messages.some((message) => message.id === messageId)) return
    mark(chat, [messageId], null)
    void options.flush?.().catch(() => undefined)
  })
  tryOnScopeDispose(stopRestored)

  /** Undoes a reply's edits and marks it; false when its edits are no longer on top. */
  function revert(chat: ChatInstance, messageId: string): boolean {
    if (!revertTurn(messageId)) return false
    mark(chat, [messageId], {})
    return true
  }

  /** `text` with a note about the reverts `history` has not reported, and those reverts. */
  function note(text: string, history: readonly UIMessage[]) {
    const reverts = revertsToReport(history)
    return { text: appendRevertedTurnContext(text, reverts.length), reverts }
  }

  /** Records that `request` carried the note about `reverts`. */
  function reported(chat: ChatInstance, reverts: readonly string[], request: string): void {
    mark(chat, reverts, { reportedIn: request })
  }

  return { revert, note, reported }
}
