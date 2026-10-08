import { computed, markRaw, ref, type Ref } from 'vue'

import { designMessageWithImageFindings } from '@/app/ai/attachment/image/analyze'
import { revokeImagePreviewURL } from '@/app/ai/attachment/image/prepare'
import {
  imageDraftPresentations,
  preparedImagePresentations
} from '@/app/ai/attachment/image/presentation'
import { snapshotNode } from '@/app/ai/attachment/node/snapshot'
import {
  deleteMessageAttachments,
  setMessageAttachments
} from '@/app/ai/attachment/presentation/store'
import { setVisibleMessageText } from '@/app/ai/chat/presentation'
import { reportSubmissionError, type SubmissionErrorOptions } from '@/app/ai/chat/submission/errors'
import { prepareSubmittedImages } from '@/app/ai/chat/submission/images'
import { useRevertRecords } from '@/app/ai/chat/submission/reverts'
import type { ChatInstance, ChatSubmission } from '@/app/ai/chat/submission/types'
import { recordTurn, restoreTurn, revertTurn } from '@/app/ai/chat/turns'
import { runUndoEntries } from '@/app/ai/tools'
import type { EditorStore } from '@/app/editor/active-store'

interface SubmissionOptions extends SubmissionErrorOptions {
  chat: Ref<ChatInstance | null>
  ensureChat: () => Promise<ChatInstance | null>
  flush?: () => Promise<void>
  clearFailure: () => void
  getEditor: () => EditorStore
}

export function useChatSubmission(options: SubmissionOptions) {
  const isPreparingAttachments = ref(false)
  let operationVersion = 0

  function lastAssistantId(chat: ChatInstance): string | undefined {
    return chat.messages.findLast((message) => message.role === 'assistant')?.id
  }

  const reverts = useRevertRecords({ chat: options.chat, flush: options.flush })

  /** Redoes a reverted reply's edits; Redo noticing them removes the mark. */
  async function restore(messageId: string): Promise<void> {
    if (!readyChat() || !restoreTurn(messageId)) return
    await options.flush?.().catch(() => undefined)
  }

  /** Undoes a reply's edits and marks it, so the chat and the next request both say so. */
  async function revert(messageId: string): Promise<void> {
    const currentChat = readyChat()
    if (!currentChat || !reverts.revert(currentChat, messageId)) return
    await options.flush?.().catch(() => undefined)
  }

  /** Runs one message and keeps the undo entries its edits pushed, so the turn can be reverted. */
  async function withTurn(chat: ChatInstance, send: () => Promise<void>): Promise<void> {
    const previous = lastAssistantId(chat)
    await send()
    const reply = lastAssistantId(chat)
    if (!reply || reply === previous) return
    const editor = options.getEditor()
    recordTurn(reply, editor, runUndoEntries(editor))
  }

  async function sendText(
    currentChat: ChatInstance,
    submission: ChatSubmission,
    dispatch: () => void
  ): Promise<void> {
    const previousIds = new Set(currentChat.messages.map((message) => message.id))
    dispatch()
    await withTurn(currentChat, () =>
      currentChat.sendMessage({ text: submission.modelText }).catch(() => undefined)
    )
    const message = currentChat.messages.find(
      (candidate) => candidate.role === 'user' && !previousIds.has(candidate.id)
    )
    if (message) setVisibleMessageText(message.id, submission.displayText)
  }

  /**
   * Shows the message at once and sends it once its images are prepared. A failure before it
   * is sent takes the message back out, so the composer can restore the draft.
   */
  async function sendAttachments(
    currentChat: ChatInstance,
    submission: ChatSubmission,
    version: number,
    dispatch: () => void
  ): Promise<void> {
    const messageId = crypto.randomUUID()
    const editor = options.getEditor()
    const nodeAttachments = submission.nodes
      .map((node) => snapshotNode(editor, messageId, node))
      .filter((attachment) => attachment !== null)
    currentChat.messages = [
      ...currentChat.messages,
      { id: messageId, role: 'user', parts: [{ type: 'text', text: submission.modelText }] }
    ]
    setVisibleMessageText(messageId, submission.displayText)
    const draftImages = imageDraftPresentations(messageId, submission.images)
    setMessageAttachments(messageId, [...nodeAttachments, ...draftImages])
    // The message previews its images from their files; the composer's previews go once sent.
    const send = () => {
      dispatch()
      for (const image of submission.images) revokeImagePreviewURL(image.previewURL)
    }

    if (submission.images.length === 0) {
      send()
      await withTurn(currentChat, () =>
        currentChat.sendMessage({ messageId, text: submission.modelText }).catch(() => undefined)
      )
      return
    }

    const images = await prepareSubmittedImages(
      editor,
      submission.modelText,
      submission.images
    ).catch((error: unknown) => {
      currentChat.messages = currentChat.messages.filter((message) => message.id !== messageId)
      deleteMessageAttachments(messageId)
      throw error
    })
    const { prepared: preparedImages, findings } = images
    if (version !== operationVersion || options.chat.value !== currentChat) return

    const normalizedImages = preparedImagePresentations(
      messageId,
      submission.images,
      preparedImages
    )
    setMessageAttachments(messageId, [...nodeAttachments, ...normalizedImages])
    send()
    await withTurn(currentChat, () =>
      currentChat
        .sendMessage({
          messageId,
          text: designMessageWithImageFindings(
            submission.modelText,
            submission.images.map((image) => image.file.name),
            findings
          )
        })
        .catch(() => undefined)
    )
  }

  /**
   * Resolves to false when the message never reached the chat. The composer then takes the
   * submission back, attachments included, so their previews stay alive until it decides.
   */
  async function submit(submission: ChatSubmission): Promise<boolean> {
    const status = options.chat.value?.status ?? 'ready'
    if (status === 'streaming' || status === 'submitted' || isPreparingAttachments.value) {
      if (submission.images.length > 0) options.reportError(options.messages.value.requestFailed)
      return false
    }

    const version = ++operationVersion
    // Whether the message was sent: after that, a failure must not hand it back.
    let sent = false
    const dispatch = () => {
      sent = true
    }
    isPreparingAttachments.value = submission.images.length > 0
    options.clearFailure()
    try {
      const currentChat = await options.ensureChat()
      if (currentChat && version === operationVersion) options.chat.value = markRaw(currentChat)
      if (!currentChat || version !== operationVersion) {
        if (submission.images.length > 0) options.reportError(options.messages.value.requestFailed)
        return false
      }
      const note = reverts.note(submission.modelText, currentChat.messages)
      const noted = { ...submission, modelText: note.text }
      const previousIds = new Set(currentChat.messages.map((message) => message.id))
      if (submission.images.length === 0 && submission.nodes.length === 0) {
        await sendText(currentChat, noted, dispatch)
      } else {
        await sendAttachments(currentChat, noted, version, dispatch)
      }
      const request = currentChat.messages.find(
        (message) => message.role === 'user' && !previousIds.has(message.id)
      )
      if (request) reverts.reported(currentChat, note.reverts, request.id)
      return true
    } catch (error) {
      reportSubmissionError(options, error)
      return sent
    } finally {
      await options.flush?.().catch(() => undefined)
      if (version === operationVersion) isPreparingAttachments.value = false
    }
  }

  function readyChat(): ChatInstance | null {
    const currentChat = options.chat.value
    if (!currentChat || isPreparingAttachments.value) return null
    return currentChat.status === 'ready' || currentChat.status === 'error' ? currentChat : null
  }

  /** Asks again for the last reply, undoing its edits first while nothing has been edited since. */
  async function regenerate(): Promise<void> {
    const currentChat = readyChat()
    const reply = currentChat ? lastAssistantId(currentChat) : undefined
    if (!currentChat || !reply) return
    options.clearFailure()
    revertTurn(reply)
    try {
      await withTurn(currentChat, () =>
        currentChat.regenerate({ messageId: reply }).catch(() => undefined)
      )
    } finally {
      await options.flush?.().catch(() => undefined)
    }
  }

  /** Replaces the last user message and asks again, undoing the old reply's edits when it can. */
  async function resend(messageId: string, text: string): Promise<void> {
    const currentChat = readyChat()
    const trimmed = text.trim()
    if (!currentChat || !trimmed) return
    const index = currentChat.messages.findIndex((message) => message.id === messageId)
    const later = currentChat.messages.slice(index + 1)
    if (index === -1 || later.some((message) => message.role === 'user')) return
    options.clearFailure()
    for (const message of later) if (message.role === 'assistant') revertTurn(message.id)
    // Replies after the edited message are replaced; the reverts it reported need a new report.
    const note = reverts.note(trimmed, currentChat.messages.slice(0, index))
    setVisibleMessageText(messageId, trimmed)
    try {
      await withTurn(currentChat, () =>
        currentChat.sendMessage({ messageId, text: note.text }).catch(() => undefined)
      )
      reverts.reported(currentChat, note.reverts, messageId)
    } finally {
      await options.flush?.().catch(() => undefined)
    }
  }

  function cancel(): void {
    operationVersion += 1
    isPreparingAttachments.value = false
  }

  const busy = computed(() => isPreparingAttachments.value)

  return {
    busy,
    cancel,
    stop: () => options.chat.value?.stop(),
    submit,
    regenerate,
    resend,
    revert,
    restore
  }
}
