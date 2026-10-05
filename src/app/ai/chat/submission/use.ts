import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import { computed, markRaw, ref, type Ref } from 'vue'

import { AgentSetupError, type AgentSetupProblem } from '@/app/ai/agents/readiness'
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
import type { EditorStore } from '@/app/editor/active-store'

export type ChatInstance = Pick<Chat<UIMessage>, 'messages' | 'sendMessage' | 'stop'>

interface SubmissionMessages {
  openSettings: string
  requestFailed: string
  visionUnavailable: string
  runSetup: string
  agentSetup: Record<AgentSetupProblem, string>
}

interface SubmissionOptions {
  chat: Ref<Chat<UIMessage> | null>
  ensureChat: () => Promise<Chat<UIMessage> | null>
  flush?: () => Promise<void>
  clearFailure: () => void
  getEditor: () => EditorStore
  messages: Ref<SubmissionMessages>
  reportError: (message: string, action?: { label: string; run: () => void }) => void
  openModelSettings: () => void
  openSetup: () => void
}

export function useChatSubmission(options: SubmissionOptions) {
  const isPreparingAttachments = ref(false)
  let operationVersion = 0

  async function sendText(currentChat: ChatInstance, submission: ChatSubmission): Promise<void> {
    const previousIds = new Set(currentChat.messages.map((message) => message.id))
    await currentChat.sendMessage({ text: submission.modelText }).catch(() => undefined)
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
      await currentChat
        .sendMessage({ messageId, text: submission.modelText })
        .catch(() => undefined)
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
    await currentChat
      .sendMessage({
        messageId,
        text: designMessageWithImageFindings(
          submission.modelText,
          submission.images.map((image) => image.file.name),
          findings
        )
      })
      .catch(() => undefined)
  }

  function reportSubmissionError(error: unknown): void {
    console.error('Chat error:', error)
    if (error instanceof AgentSetupError) {
      options.reportError(options.messages.value.agentSetup[error.problem], {
        label: options.messages.value.runSetup,
        run: options.openSetup
      })
      return
    }
    if (error instanceof VisionModelUnavailableError) {
      options.reportError(options.messages.value.visionUnavailable, {
        label: options.messages.value.openSettings,
        run: options.openModelSettings
      })
      return
    }
    options.reportError(options.messages.value.requestFailed)
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
    // Whether the message reached the chat: after that, a failure must not hand it back.
    let sent = () => false
    isPreparingAttachments.value = submission.images.length > 0
    options.clearFailure()
    try {
      const currentChat = await options.ensureChat()
      if (currentChat && version === operationVersion) options.chat.value = markRaw(currentChat)
      if (!currentChat || version !== operationVersion) {
        if (submission.images.length > 0) options.reportError(options.messages.value.requestFailed)
        return false
      }
      const before = currentChat.messages.length
      sent = () => currentChat.messages.length > before
      if (submission.images.length === 0 && submission.nodes.length === 0) {
        await sendText(currentChat, submission)
      } else {
        await sendAttachments(currentChat, submission, version)
      }
      return true
    } catch (error) {
      reportSubmissionError(error)
      return sent()
    } finally {
      await options.flush?.().catch(() => undefined)
      if (version === operationVersion) isPreparingAttachments.value = false
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
    submit
  }
}
