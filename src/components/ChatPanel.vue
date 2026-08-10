<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { refAutoReset, useClipboard } from '@vueuse/core'
import { computed, markRaw, nextTick, ref, watch } from 'vue'

import { getAcpDebugText, clearAcpDebugLog, hasAcpDebugEntries } from '@/app/ai/acp/transport'
import { copyChatLog } from '@/app/ai/debug'
import { removeMessageFromHistory, removePartFromHistory } from '@/app/ai/chat/history'
import { recoverConversationPrefix } from '@/app/ai/chat/recovery'
import { clearPersistedChat, readPersistedChat, writePersistedChat } from '@/app/ai/chat/storage'
import { clearToolLogEntries, didHitStepLimit } from '@/app/ai/tools'
import { activeTab } from '@/app/tabs'
import AcpPermissionDialog from '@/components/chat/AcpPermissionDialog.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import { useAIChat } from '@/app/ai/chat/use'
import { toast } from '@/app/shell/ui'
import { useI18n } from '@open-pencil/vue'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import type { JsonObject } from '@open-pencil/scene-graph/primitives'

const IS_DEV = import.meta.env.DEV

const { isConfigured, ensureChat, resetChat } = useAIChat()
const { copy } = useClipboard()
const { dialogs } = useI18n()

const chat = ref<Chat<UIMessage> | null>(null)

void ensureChat()
  .then((c) => {
    if (c) chat.value = markRaw(c)
    return undefined
  })
  .catch((error: unknown) => {
    toast.error(error instanceof Error ? error.message : 'Failed to initialize chat')
  })
const messagesEnd = ref<HTMLDivElement>()
const debugCopied = refAutoReset(false, 1500)
const acpLogCopied = refAutoReset(false, 1500)
const queuedMessages = ref<Array<{ id: string; text: string }>>([])
const queuePaused = ref(false)
const recoveryNeeded = ref(readPersistedChat()?.interrupted === true)
let dispatchingMessage = false

const messages = computed(() => chat.value?.messages ?? [])
const status = computed(() => chat.value?.status ?? 'ready')
const isThinking = computed(() => {
  const s = status.value
  if (s !== 'submitted' && s !== 'streaming') return false
  if (messages.value.length === 0) return true
  const last = messages.value[messages.value.length - 1]
  if (last.role !== 'assistant') return true
  const parts = last.parts
  if (parts.length === 0) return true
  const lastPart = parts[parts.length - 1] as JsonObject
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

watch(
  messages,
  (value) => {
    scrollToBottom()
    if (value.length > 0) writePersistedChat(value, recoveryNeeded.value || isChatBusy())
  },
  { deep: true }
)
watch(status, () => {
  if (messages.value.length > 0) {
    writePersistedChat(messages.value, recoveryNeeded.value || isChatBusy())
  }
})
watch(
  () => chat.value?.error,
  (error) => {
    if (error) {
      recoveryNeeded.value = true
      if (messages.value.length > 0) writePersistedChat(messages.value, true)
      queuePaused.value = true
      toast.error(error.message)
    }
  }
)
watch(
  () => activeTab.value?.id,
  async () => {
    clearQueue()
    const nextChat = await ensureChat()
    chat.value = nextChat ? markRaw(nextChat) : null
  }
)

function isChatBusy() {
  return status.value === 'streaming' || status.value === 'submitted'
}

function enqueueMessage(text: string) {
  queuedMessages.value.push({ id: crypto.randomUUID(), text })
}

async function sendMessage(text: string, queuedMessageId?: string) {
  recoveryNeeded.value = false
  dispatchingMessage = true
  try {
    const c = await ensureChat()
    if (c) chat.value = markRaw(c)
  } catch (e) {
    console.error('Failed to initialize chat:', e)
    toast.error(e instanceof Error ? e.message : String(e))
    queuePaused.value = true
    dispatchingMessage = false
    return
  }
  if (!chat.value) {
    queuePaused.value = true
    dispatchingMessage = false
    return
  }

  if (queuedMessageId) removeQueuedMessage(queuedMessageId)

  try {
    await chat.value.sendMessage({ text })
  } catch (e) {
    console.error('Chat error:', e)
    toast.error(e instanceof Error ? e.message : String(e))
    queuePaused.value = true
  } finally {
    dispatchingMessage = false
  }

  await dispatchNextMessage()
}

async function retryLastMessage() {
  if (!chat.value || isChatBusy()) return
  const recovered = recoverConversationPrefix(messages.value)
  const last = recovered[recovered.length - 1]
  if (!last) return

  recoveryNeeded.value = false
  queuePaused.value = false
  try {
    chat.value.messages = recovered
    if (last.role === 'user') {
      await chat.value.regenerate({ messageId: last.id })
    } else {
      const continuation: UIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        parts: []
      }
      chat.value.messages = [...recovered, continuation]
      await chat.value.regenerate({ messageId: continuation.id })
    }
  } catch (error) {
    recoveryNeeded.value = true
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

async function dispatchNextMessage() {
  if (queuePaused.value || dispatchingMessage || isChatBusy()) return
  const next = queuedMessages.value[0]
  if (next) await sendMessage(next.text, next.id)
}

function handleSubmit(text: string) {
  if (isChatBusy() || dispatchingMessage || queuePaused.value) {
    enqueueMessage(text)
    return
  }
  void sendMessage(text)
}

function handleStop() {
  recoveryNeeded.value = true
  if (messages.value.length > 0) writePersistedChat(messages.value, true)
  queuePaused.value = true
  chat.value?.stop()
}

function removeQueuedMessage(id: string) {
  queuedMessages.value = queuedMessages.value.filter((message) => message.id !== id)
  if (queuedMessages.value.length === 0) queuePaused.value = false
}

function persistEditedHistory(updatedMessages: UIMessage[]) {
  if (!chat.value || isChatBusy()) return
  chat.value.messages = updatedMessages
  recoveryNeeded.value = updatedMessages.length > 0
  if (updatedMessages.length > 0) writePersistedChat(updatedMessages, true)
  else clearPersistedChat()
}

function removeChatMessage(messageId: string) {
  persistEditedHistory(removeMessageFromHistory(messages.value, messageId))
}

function removeToolExecution(messageId: string, partKey: string) {
  persistEditedHistory(removePartFromHistory(messages.value, messageId, partKey))
}

function clearQueue() {
  queuedMessages.value = []
  queuePaused.value = false
}

function resumeQueue() {
  queuePaused.value = false
  void dispatchNextMessage()
}

async function handleCopyDebug() {
  await copyChatLog(messages.value)
  debugCopied.value = true
}

async function handleCopyAcpLog() {
  const text = getAcpDebugText()
  if (!text) return
  await copy(text)
  acpLogCopied.value = true
}

function handleClearChat() {
  clearQueue()
  chat.value = null
  resetChat()
  clearPersistedChat()
  recoveryNeeded.value = false
  clearToolLogEntries()
  clearAcpDebugLog()
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
            :label="dialogs.describeCreateOrChange"
            :ui="{ root: 'h-full' }"
          >
            <template #icon>
              <icon-lucide-message-circle class="size-5" />
            </template>
          </AppPlaceholder>

          <!-- Messages -->
          <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
            <ChatMessage
              v-for="msg in messages"
              :key="msg.id"
              :message="msg"
              :removable="status === 'ready'"
              @remove-message="removeChatMessage(msg.id)"
              @remove-part="removeToolExecution(msg.id, $event)"
            />

            <div v-if="recoveryNeeded && status === 'ready'" class="flex justify-center py-2">
              <button
                type="button"
                data-test-id="chat-retry-last-message"
                class="flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                @click="retryLastMessage"
              >
                <icon-lucide-rotate-ccw class="size-3" />
                {{ dialogs.retryLastMessage }}
              </button>
            </div>

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
        <AppTextButton
          v-if="IS_DEV"
          :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover' }"
          @click="handleCopyDebug"
        >
          <icon-lucide-clipboard-copy v-if="!debugCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-green-400" />
          {{ debugCopied ? 'Copied' : 'Copy log' }}
        </AppTextButton>
        <AppTextButton
          v-if="IS_DEV && hasAcpDebugEntries()"
          :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover' }"
          @click="handleCopyAcpLog"
        >
          <icon-lucide-bug v-if="!acpLogCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-green-400" />
          {{ acpLogCopied ? 'Copied' : 'ACP log' }}
        </AppTextButton>
        <AppTextButton
          :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover' }"
          @click="handleClearChat"
        >
          <icon-lucide-trash-2 class="size-3" />
          Clear
        </AppTextButton>
      </div>

      <div
        v-if="queuedMessages.length > 0"
        data-test-id="chat-message-queue"
        class="shrink-0 border-t border-border px-3 py-2"
      >
        <div class="mb-1.5 flex items-center gap-2 text-[10px] font-medium text-muted">
          <span>{{ dialogs.queuedMessages({ count: queuedMessages.length }) }}</span>
          <button
            v-if="queuePaused"
            type="button"
            data-test-id="chat-queue-resume"
            class="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-accent hover:bg-hover"
            @click="resumeQueue"
          >
            <icon-lucide-play class="size-3" />
            {{ dialogs.resumeQueue }}
          </button>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 hover:bg-hover hover:text-surface"
            @click="clearQueue"
          >
            {{ dialogs.clearQueue }}
          </button>
        </div>
        <div class="flex max-h-24 flex-col gap-1 overflow-y-auto">
          <div
            v-for="message in queuedMessages"
            :key="message.id"
            data-test-id="chat-queued-message"
            class="flex items-center gap-2 rounded bg-muted/10 px-2 py-1 text-xs"
          >
            <span class="min-w-0 flex-1 truncate">{{ message.text }}</span>
            <button
              type="button"
              :aria-label="dialogs.removeQueuedMessage"
              class="shrink-0 rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
              @click="removeQueuedMessage(message.id)"
            >
              <icon-lucide-x class="size-3" />
            </button>
          </div>
        </div>
      </div>

      <ChatInput :status="status" @submit="handleSubmit" @stop="handleStop" />

      <AcpPermissionDialog />
    </template>
  </div>
</template>
