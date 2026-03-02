<script setup lang="ts">
import { useEventListener, useScroll } from '@vueuse/core'
import { computed, markRaw, nextTick, ref, watch } from 'vue'

import { useAIChat } from '@/composables/use-chat'

import APIKeySetup from './APIKeySetup.vue'
import ChatInput from './ChatInput.vue'
import ChatMessage from './ChatMessage.vue'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'

const { isConfigured, ensureChat, resetChat } = useAIChat()

const chat = ref<Chat<UIMessage> | null>(null)
const scrollEl = ref<HTMLElement>()
const atBottom = ref(true)

const messages = computed(() => chat.value?.messages ?? [])
const status = computed(() => chat.value?.status ?? 'ready')

// ── Scroll tracking ──────────────────────────────────────────
const { arrivedState } = useScroll(scrollEl, { offset: { bottom: 64 } })
watch(arrivedState, (s) => {
  atBottom.value = s.bottom
})

async function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior })
}

watch(messages, () => {
  if (atBottom.value) scrollToBottom()
}, { deep: true })

// ── Actions ──────────────────────────────────────────────────
const SUGGESTIONS = [
  'Create a login screen with email + password',
  'Design a card component with title, body, and CTA button',
  'Build a navigation bar with logo and links',
  'Make a hero section with heading and sub-text'
]

function handleSubmit(text: string, files?: FileList) {
  if (!chat.value) {
    const c = ensureChat()
    if (c) chat.value = markRaw(c)
  }
  chat.value
    ?.sendMessage(files?.length ? { text, files } : { text })
    .catch(() => {})
  scrollToBottom('instant')
}

function handleStop() {
  chat.value?.stop()
}

function handleClear() {
  resetChat()
  chat.value = null
}

function handleDownload() {
  const lines = messages.value.flatMap((m) => {
    const role = m.role === 'user' ? '**You**' : '**AI**'
    const text = m.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('')
    return text ? [`${role}: ${text}`] : []
  })
  const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'conversation.md'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Keyboard shortcut: Cmd/Ctrl+K to clear
useEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k' && chat.value) {
    handleClear()
  }
})
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
    <APIKeySetup v-if="!isConfigured" />

    <template v-else>
      <!-- Toolbar -->
      <div class="flex shrink-0 items-center justify-end gap-1 border-b border-border px-2 py-1">
        <button
          v-if="messages.length > 0"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-hover hover:text-surface"
          title="Download conversation"
          @click="handleDownload"
        >
          <icon-lucide-download class="size-3" />
        </button>
        <button
          v-if="messages.length > 0"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-hover hover:text-surface"
          title="Clear conversation (⌘K)"
          @click="handleClear"
        >
          <icon-lucide-trash-2 class="size-3" />
        </button>
      </div>

      <!-- Messages -->
      <div ref="scrollEl" class="relative min-h-0 flex-1 overflow-y-auto">
        <!-- Empty state -->
        <div
          v-if="messages.length === 0"
          class="flex h-full flex-col items-center justify-center gap-4 px-4 py-6"
        >
          <div class="flex size-10 items-center justify-center rounded-xl bg-accent/10">
            <icon-lucide-sparkles class="size-5 text-accent" />
          </div>
          <div class="text-center">
            <p class="text-xs font-medium text-surface">Ask AI to design</p>
            <p class="mt-0.5 text-[11px] text-muted">Describe what you want to create</p>
          </div>
          <div class="flex w-full flex-col gap-1.5">
            <button
              v-for="s in SUGGESTIONS"
              :key="s"
              class="rounded-lg border border-border px-3 py-2 text-left text-[11px] text-muted transition-colors hover:border-accent/40 hover:bg-hover hover:text-surface"
              @click="handleSubmit(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>

        <!-- Message list -->
        <div v-else class="flex flex-col gap-2 px-3 py-3">
          <ChatMessage
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            :is-streaming="status === 'streaming' && msg === messages[messages.length - 1]"
          />

          <!-- Thinking indicator (submitted but no first token yet) -->
          <div v-if="status === 'submitted'" class="flex items-center gap-2 py-1">
            <div
              class="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10"
            >
              <icon-lucide-sparkles class="size-3 text-accent" />
            </div>
            <div class="flex items-center gap-1">
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
        </div>
      </div>

      <!-- Scroll to bottom FAB -->
      <Transition name="fade">
        <button
          v-if="!atBottom && messages.length > 0"
          class="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border bg-panel px-3 py-1.5 text-[11px] text-muted shadow-lg hover:bg-hover hover:text-surface"
          @click="scrollToBottom()"
        >
          <icon-lucide-arrow-down class="size-3" />
          Scroll to bottom
        </button>
      </Transition>

      <ChatInput :status="status" @submit="handleSubmit" @stop="handleStop" />
    </template>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
