<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { computed, markRaw, nextTick, ref, watch } from 'vue'

import { getAcpDebugText, clearAcpDebugLog, hasAcpDebugEntries } from '@/ai/acp-transport'
import { copyChatLog } from '@/ai/chat-debug'
import { clearToolLogEntries, didHitStepLimit } from '@/ai/tools'
import { activeTab } from '@/stores/tabs'
import ACPPermissionDialog from '@/components/chat/ACPPermissionDialog.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import { useAIChat } from '@/composables/use-chat'
import { useI18n } from '@open-pencil/vue'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'

const IS_DEV = import.meta.env.DEV

const { isConfigured, ensureChat, resetChat } = useAIChat()
const { dialogs } = useI18n()

const chat = ref<Chat<UIMessage> | null>(null)

ensureChat().then((c) => {
  if (c) chat.value = markRaw(c)
})
const messagesEnd = ref<HTMLDivElement>()
const debugCopied = ref(false)
const acpLogCopied = ref(false)
const initError = ref<string | null>(null)

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
  const lastPart = parts[parts.length - 1] as Record<string, unknown>
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
  () => activeTab.value?.id,
  async () => {
    const nextChat = await ensureChat()
    chat.value = nextChat ? markRaw(nextChat) : null
  }
)

async function handleSubmit(text: string) {
  if (status.value === 'streaming' || status.value === 'submitted') return
  try {
    initError.value = null
    const c = await ensureChat()
    if (c) chat.value = markRaw(c)
  } catch (e) {
    console.error('Failed to initialize chat:', e)
    initError.value = e instanceof Error ? e.message : String(e)
    return
  }
  chat.value?.sendMessage({ text }).catch((e: unknown) => {
    console.error('Chat error:', e)
  })
}

function handleStop() {
  chat.value?.stop()
}

async function handleCopyDebug() {
  await copyChatLog(messages.value)
  debugCopied.value = true
  setTimeout(() => {
    debugCopied.value = false
  }, 1500)
}

async function handleCopyAcpLog() {
  const text = getAcpDebugText()
  if (!text) return
  await navigator.clipboard.writeText(text)
  acpLogCopied.value = true
  setTimeout(() => {
    acpLogCopied.value = false
  }, 1500)
}

function handleClearChat() {
  chat.value = null
  resetChat()
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
          <!-- Empty state -->
          <div
            v-if="messages.length === 0"
            data-test-id="chat-empty-state"
            class="flex h-full flex-col items-center justify-center gap-3 text-muted"
          >
            <icon-lucide-message-circle class="size-8 opacity-50" />
            <p class="text-center text-xs">{{ dialogs.describeCreateOrChange }}</p>
          </div>

          <!-- Messages -->
          <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
            <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" />

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
        <button
          v-if="IS_DEV"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-hover hover:text-surface"
          @click="handleCopyDebug"
        >
          <icon-lucide-clipboard-copy v-if="!debugCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-green-400" />
          {{ debugCopied ? 'Copied' : 'Copy log' }}
        </button>
        <button
          v-if="IS_DEV && hasAcpDebugEntries()"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-hover hover:text-surface"
          @click="handleCopyAcpLog"
        >
          <icon-lucide-bug v-if="!acpLogCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-green-400" />
          {{ acpLogCopied ? 'Copied' : 'ACP log' }}
        </button>
        <button
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-hover hover:text-surface"
          @click="handleClearChat"
        >
          <icon-lucide-trash-2 class="size-3" />
          Clear
        </button>
      </div>

      <!-- Connection error banner -->
      <div
        v-if="initError"
        class="flex items-center gap-2 border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-400"
      >
        <icon-lucide-circle-alert class="size-3.5 shrink-0" />
        <span class="min-w-0 flex-1">{{ initError }}</span>
        <button class="shrink-0 text-red-300 hover:text-red-200" @click="initError = null">
          <icon-lucide-x class="size-3" />
        </button>
      </div>

      <ChatInput :status="status" @submit="handleSubmit" @stop="handleStop" />

      <ACPPermissionDialog />
    </template>
  </div>
</template>
