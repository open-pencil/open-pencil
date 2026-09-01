<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { refAutoReset, useClipboard } from '@vueuse/core'
import { computed, markRaw, nextTick, ref, watch } from 'vue'

import { getACPDebugText, clearACPDebugLog, hasACPDebugEntries } from '@/app/ai/acp/transport'
import { copyChatLog } from '@/app/ai/debug'
import {
  analyzeAttachedImages,
  designMessageWithImageFindings
} from '@/app/ai/attachment/image/analyze'
import {
  createImagePreviewURL,
  isImageAttachmentMediaType,
  prepareImageAttachment,
  revokeImagePreviewURL
} from '@/app/ai/attachment/image/prepare'
import {
  clearImageAttachmentPresentations,
  setImageAttachmentPresentations
} from '@/app/ai/attachment/image/presentation'
import type { ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import { clearToolLogEntries, didHitStepLimit } from '@/app/ai/tools'
import { activeTab } from '@/app/tabs'
import { getActiveEditorStore } from '@/app/editor/active-store'
import ACPPermissionDialog from '@/components/chat/ACPPermissionDialog.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import { useAIChat } from '@/app/ai/chat/use'
import { toast } from '@/app/shell/ui'
import { useI18n } from '@open-pencil/vue'

import { useNotificationMessages } from '@/app/i18n/notifications'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

const IS_DEV = import.meta.env.DEV

const { isConfigured, ensureChat, resetChat, chatFailure, clearChatFailure } = useAIChat()
const { copy } = useClipboard()
const { ai } = useI18n()
const notifications = useNotificationMessages()

const chat = ref<Chat<UIMessage> | null>(null)
const isPreparingImages = ref(false)
let attachmentOperationVersion = 0

void ensureChat()
  .then((c) => {
    if (c) chat.value = markRaw(c)
    return undefined
  })
  .catch((error: unknown) => {
    toast.error(
      notifications.value.chatInitializationFailed({
        error: error instanceof Error ? error.message : String(error)
      })
    )
  })
const messagesEnd = ref<HTMLDivElement>()
const debugCopied = refAutoReset(false, 1500)
const acpLogCopied = refAutoReset(false, 1500)

const messages = computed(() => chat.value?.messages ?? [])
const failureMessage = computed(() => {
  switch (chatFailure.value?.reason) {
    case 'insufficient-credit':
      return ai.value.chatInsufficientCredit
    case 'output-limit':
      return ai.value.chatOutputLimit
    case 'request-failed':
      return ai.value.chatRequestFailed
    default:
      return null
  }
})
const status = computed(() => chat.value?.status ?? 'ready')
function isStreamingMessage(message: UIMessage, index: number): boolean {
  return (
    message.role === 'assistant' &&
    index === messages.value.length - 1 &&
    (status.value === 'submitted' || status.value === 'streaming')
  )
}
const isThinking = computed(() => {
  const s = status.value
  if (s !== 'submitted' && s !== 'streaming') return false
  if (messages.value.length === 0) return true
  const last = messages.value[messages.value.length - 1]
  if (last.role !== 'assistant') return true
  const parts = last.parts
  if (parts.length === 0) return true
  const lastPart = parts[parts.length - 1] as JSONObject
  if (lastPart.type === 'step-start') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-available') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-error') return true
  return s === 'submitted'
})

const showContinue = computed(() => {
  if (status.value !== 'ready') return false
  if (messages.value.length === 0) return false
  const last = messages.value[messages.value.length - 1]
  return last.role === 'assistant' && didHitStepLimit()
})

function scrollToBottom() {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

watch(messages, scrollToBottom, { deep: true })
watch(
  () => chatFailure.value?.reason,
  (reason) => {
    if (!reason) return
    toast.error(failureMessage.value ?? ai.value.chatRequestFailed)
  }
)
watch(
  () => activeTab.value?.id,
  async () => {
    attachmentOperationVersion += 1
    isPreparingImages.value = false
    clearImageAttachmentPresentations()
    const nextChat = await ensureChat()
    chat.value = nextChat ? markRaw(nextChat) : null
  }
)

async function handleSubmit(text: string, images: ImageAttachmentDraft[] = []) {
  if (status.value === 'streaming' || status.value === 'submitted' || isPreparingImages.value) {
    for (const image of images) revokeImagePreviewURL(image.previewURL)
    if (images.length > 0) toast.error(ai.value.chatRequestFailed)
    return
  }

  const operationVersion = ++attachmentOperationVersion
  if (images.length > 0) isPreparingImages.value = true
  clearChatFailure()
  try {
    const currentChat = chat.value ?? (await ensureChat())
    if (currentChat) chat.value = markRaw(currentChat)
    if (!currentChat || operationVersion !== attachmentOperationVersion) {
      for (const image of images) revokeImagePreviewURL(image.previewURL)
      if (images.length > 0) toast.error(ai.value.chatRequestFailed)
      return
    }

    if (images.length === 0) {
      await currentChat.sendMessage({ text })
      return
    }

    const messageId = crypto.randomUUID()
    currentChat.messages = [
      ...currentChat.messages,
      { id: messageId, role: 'user', parts: [{ type: 'text', text }] }
    ]
    setImageAttachmentPresentations(
      messageId,
      images.map((image) => ({
        id: crypto.randomUUID(),
        messageId,
        name: image.file.name,
        mediaType: isImageAttachmentMediaType(image.file.type) ? image.file.type : 'image/png',
        originalWidth: 0,
        originalHeight: 0,
        previewWidth: 0,
        previewHeight: 0,
        previewURL: image.previewURL,
        displayText: text
      }))
    )

    const preparedImages = await Promise.all(
      images.map((image) => prepareImageAttachment(image.file))
    )
    const findings = await analyzeAttachedImages(getActiveEditorStore(), text, preparedImages)
    if (operationVersion !== attachmentOperationVersion || chat.value !== currentChat) return

    setImageAttachmentPresentations(
      messageId,
      preparedImages.map((prepared, index) => {
        const image = images[index]
        const previewURL = createImagePreviewURL(prepared.blob)
        return {
          id: crypto.randomUUID(),
          messageId,
          name: image?.file.name ?? `Image ${index + 1}`,
          mediaType: prepared.mediaType,
          originalWidth: prepared.originalWidth,
          originalHeight: prepared.originalHeight,
          previewWidth: prepared.width,
          previewHeight: prepared.height,
          previewURL,
          displayText: text
        }
      })
    )
    await currentChat.sendMessage({
      messageId,
      text: designMessageWithImageFindings(
        text,
        images.map((image) => image.file.name),
        findings
      )
    })
  } catch (e) {
    console.error('Chat error:', e)
    toast.error(ai.value.chatRequestFailed)
  } finally {
    if (operationVersion === attachmentOperationVersion) isPreparingImages.value = false
  }
}

function handleStop() {
  chat.value?.stop()
}

async function handleCopyDebug() {
  await copyChatLog(messages.value, chatFailure.value)
  debugCopied.value = true
}

async function handleCopyACPLog() {
  const text = getACPDebugText()
  if (!text) return
  await copy(text)
  acpLogCopied.value = true
}

function handleClearChat() {
  attachmentOperationVersion += 1
  isPreparingImages.value = false
  clearChatFailure()
  clearImageAttachmentPresentations()
  chat.value = null
  void resetChat().catch((error: unknown) => {
    console.error('Chat reset error:', error)
  })
  clearToolLogEntries()
  clearACPDebugLog()
}
</script>

<template>
  <div data-test-id="chat-panel" class="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
    <ProviderSetup v-if="!isConfigured" />

    <template v-else>
      <ScrollAreaRoot class="min-h-0 flex-1">
        <ScrollAreaViewport class="h-full px-3 py-3 [&>div]:h-full">
          <AppPlaceholder
            v-if="messages.length === 0"
            data-test-id="chat-empty-state"
            :label="ai.describeCreateOrChange"
            :ui="{ root: 'h-full' }"
          >
            <template #icon>
              <icon-lucide-message-circle class="size-5" />
            </template>
          </AppPlaceholder>

          <!-- Messages -->
          <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
            <ChatMessage
              v-for="(msg, index) in messages"
              :key="msg.id"
              :message="msg"
              :streaming="isStreamingMessage(msg, index)"
            />

            <!-- Thinking indicator: shown when AI is working but no visible activity -->
            <div v-if="isThinking" data-test-id="chat-typing-indicator" class="flex gap-2">
              <div
                class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-[10px] font-bold text-muted"
              >
                AI
              </div>
              <div class="flex items-center gap-1 py-2">
                <span
                  class="size-1.5 animate-bounce rounded-full bg-muted"
                  style="animation-delay: 0ms"
                />
                <span
                  class="size-1.5 animate-bounce rounded-full bg-muted"
                  style="animation-delay: 150ms"
                />
                <span
                  class="size-1.5 animate-bounce rounded-full bg-muted"
                  style="animation-delay: 300ms"
                />
              </div>
            </div>

            <!-- Continue button when step limit reached -->
            <div v-if="showContinue" class="flex justify-center py-2">
              <button
                class="flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                @click="handleSubmit('Continue where you left off')"
              >
                <icon-lucide-play class="size-3" />
                Continue
              </button>
            </div>

            <div ref="messagesEnd" />
          </div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
          <ScrollAreaThumb class="relative flex-1 rounded-full bg-muted/30" />
        </ScrollAreaScrollbar>
      </ScrollAreaRoot>

      <!-- Chat toolbar -->
      <div
        v-if="messages.length > 0"
        class="flex shrink-0 items-center gap-1 border-t border-border px-3 py-1"
      >
        <AppButton v-if="IS_DEV" color="neutral" variant="ghost" size="xs" @click="handleCopyDebug">
          <icon-lucide-clipboard-copy v-if="!debugCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-green-400" />
          {{ debugCopied ? 'Copied' : 'Copy log' }}
        </AppButton>
        <AppButton
          v-if="IS_DEV && hasACPDebugEntries()"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="handleCopyACPLog"
        >
          <icon-lucide-bug v-if="!acpLogCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-green-400" />
          {{ acpLogCopied ? 'Copied' : 'ACP log' }}
        </AppButton>
        <AppButton color="error" variant="ghost" size="xs" @click="handleClearChat">
          <icon-lucide-trash-2 class="size-3" />
          Clear
        </AppButton>
      </div>

      <ChatInput
        :status="status"
        :disabled="isPreparingImages"
        @submit="handleSubmit"
        @stop="handleStop"
        @error="toast.error"
      />

      <ACPPermissionDialog />
    </template>
  </div>
</template>
