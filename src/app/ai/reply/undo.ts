import { tryOnScopeDispose } from '@vueuse/core'
import type { UIMessage } from 'ai'
import type { Ref } from 'vue'

import { appendUndoneCallsContext } from '@/app/ai/chat/context'
import { undoOf, updateMessage, withUndo, type ReplyUndo } from '@/app/ai/chat/metadata'
import type { ChatInstance } from '@/app/ai/chat/submission/types'
import {
  onTurnUndoChanged,
  recordReplyTurn,
  undoToReport,
  type UndoReport
} from '@/app/ai/reply/turns'
import type { EditorStore } from '@/app/editor/active-store'

interface UndoRecordOptions {
  chat: Ref<ChatInstance | null>
  flush?: () => Promise<void>
  getEditor: () => EditorStore
}

/**
 * Keeps each reply's undone edits marked in the chat and tells the model about them. Undo and
 * Redo in the editor, as much as the chat's Revert and Restore, mark the calls they touch;
 * the next request carries a note with what changed since the model last heard.
 */
export function useUndoRecords(options: UndoRecordOptions) {
  function update(
    chat: ChatInstance,
    messageId: string,
    change: (undo: ReplyUndo) => ReplyUndo
  ): void {
    updateMessage(chat, messageId, (message) => {
      const undo = undoOf(message)
      return undo ? withUndo(message, change(undo)) : message
    })
  }

  const stopUndo = onTurnUndoChanged((messageId, undone) => {
    const chat = options.chat.value
    if (!chat?.messages.some((message) => message.id === messageId)) return
    update(chat, messageId, (undo) => ({ ...undo, undone: [...undone] }))
    void options.flush?.().catch(() => undefined)
  })
  tryOnScopeDispose(stopUndo)

  function lastAssistantId(chat: ChatInstance): string | undefined {
    return chat.messages.findLast((message) => message.role === 'assistant')?.id
  }

  /** Runs one message and keeps its reply's edits, so they can be reverted and marked when undone. */
  async function withTurn(chat: ChatInstance, send: () => Promise<void>): Promise<void> {
    const previous = lastAssistantId(chat)
    await send()
    const reply = lastAssistantId(chat)
    if (!reply || reply === previous) return
    const undo = await recordReplyTurn(reply, options.getEditor())
    if (!undo) return
    updateMessage(chat, reply, (message) => withUndo(message, undo))
  }

  /** `text` with a note about the undone edits `history` has not reported, and those reports. */
  function note(text: string, history: readonly UIMessage[]) {
    const reports = undoToReport(history)
    const calls = {
      undone: reports.flatMap((report) => report.calls.undone),
      redone: reports.flatMap((report) => report.calls.redone)
    }
    return { text: appendUndoneCallsContext(text, calls), reports }
  }

  /** Records that `request` told the model about `reports`. */
  function reported(chat: ChatInstance, reports: readonly UndoReport[], request: string): void {
    for (const report of reports) {
      update(chat, report.messageId, (undo) => ({
        ...undo,
        reported: { undone: [...report.undone], in: request }
      }))
    }
  }

  return { withTurn, note, reported }
}
