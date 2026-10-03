import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import { computed, markRaw, ref, type Ref } from 'vue'

import {
  analyzeAttachedImages,
  designMessageWithImageFindings,
  VisionModelUnavailableError
} from '@/app/ai/attachment/image/analyze'
import { prepareImageAttachment, revokeImagePreviewURL } from '@/app/ai/attachment/image/prepare'
import {
  imageDraftPresentations,
  preparedImagePresentations
} from '@/app/ai/attachment/image/presentation'
import { snapshotNode } from '@/app/ai/attachment/node/snapshot'
import { setMessageAttachments } from '@/app/ai/attachment/presentation/store'
import { setVisibleMessageText } from '@/app/ai/chat/presentation'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'
import { recordTurn, revertTurn } from '@/app/ai/chat/turns'
import { runUndoEntries } from '@/app/ai/tools'
import type { EditorStore } from '@/app/editor/active-store'

/** The part of the AI SDK Chat that submissions drive. */
export type ChatInstance = Pick<
  Chat<UIMessage>,
  'messages' | 'sendMessage' | 'stop' | 'regenerate' | 'status'
>

interface SubmissionMessages {
  openSettings: string
  requestFailed: string
  visionUnavailable: string
}

interface SubmissionOptions {
  chat: Ref<ChatInstance | null>
  ensureChat: () => Promise<ChatInstance | null>
  flush?: () => Promise<void>
  clearFailure: () => void
  getEditor: () => EditorStore
  messages: Ref<SubmissionMessages>
  reportError: (message: string, action?: { label: string; run: () => void }) => void
  openModelSettings: () => void
}

export function useChatSubmission(options: SubmissionOptions) {
  const isPreparingAttachments = ref(false)
  let operationVersion = 0

  function lastAssistantId(chat: ChatInstance): string | undefined {
    return chat.messages.findLast((message) => message.role === 'assistant')?.id
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

  async function sendText(currentChat: ChatInstance, submission: ChatSubmission): Promise<void> {
    const previousIds = new Set(currentChat.messages.map((message) => message.id))
    await withTurn(currentChat, () =>
      currentChat.sendMessage({ text: submission.modelText }).catch(() => undefined)
    )
    const message = currentChat.messages.find(
      (candidate) => candidate.role === 'user' && !previousIds.has(candidate.id)
    )
    if (message) setVisibleMessageText(message.id, submission.displayText)
  }

  async function sendAttachments(
    currentChat: ChatInstance,
    submission: ChatSubmission,
    version: number
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
    for (const image of submission.images) revokeImagePreviewURL(image.previewURL)

    if (submission.images.length === 0) {
      await withTurn(currentChat, () =>
        currentChat.sendMessage({ messageId, text: submission.modelText }).catch(() => undefined)
      )
      return
    }

    const preparedImages = await Promise.all(
      submission.images.map((image) => prepareImageAttachment(image.file))
    )
    const findings = await analyzeAttachedImages(editor, submission.modelText, preparedImages)
    if (version !== operationVersion || options.chat.value !== currentChat) return

    const normalizedImages = preparedImagePresentations(
      messageId,
      submission.images,
      preparedImages
    )
    setMessageAttachments(messageId, [...nodeAttachments, ...normalizedImages])
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

  function reportSubmissionError(error: unknown): void {
    console.error('Chat error:', error)
    if (error instanceof VisionModelUnavailableError) {
      options.reportError(options.messages.value.visionUnavailable, {
        label: options.messages.value.openSettings,
        run: options.openModelSettings
      })
      return
    }
    options.reportError(options.messages.value.requestFailed)
  }

  async function submit(submission: ChatSubmission): Promise<void> {
    const status = options.chat.value?.status ?? 'ready'
    if (status === 'streaming' || status === 'submitted' || isPreparingAttachments.value) {
      for (const image of submission.images) revokeImagePreviewURL(image.previewURL)
      if (submission.images.length > 0) options.reportError(options.messages.value.requestFailed)
      return
    }

    const version = ++operationVersion
    isPreparingAttachments.value = submission.images.length > 0
    options.clearFailure()
    try {
      const currentChat = await options.ensureChat()
      if (currentChat && version === operationVersion) options.chat.value = markRaw(currentChat)
      if (!currentChat || version !== operationVersion) {
        for (const image of submission.images) revokeImagePreviewURL(image.previewURL)
        if (submission.images.length > 0) options.reportError(options.messages.value.requestFailed)
        return
      }
      if (submission.images.length === 0 && submission.nodes.length === 0) {
        await sendText(currentChat, submission)
      } else {
        await sendAttachments(currentChat, submission, version)
      }
    } catch (error) {
      reportSubmissionError(error)
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
    setVisibleMessageText(messageId, trimmed)
    try {
      await withTurn(currentChat, () =>
        currentChat.sendMessage({ messageId, text: trimmed }).catch(() => undefined)
      )
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
    resend
  }
}
