<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { ref } from 'vue'
import IconPlay from '~icons/lucide/play'
import IconRotateCcw from '~icons/lucide/rotate-ccw'

import { useEditorStore } from '@/app/editor/active-store'
import ChatTranscript from '@/components/chat/ChatTranscript.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

import { useLandingMessages } from '#docs/theme/landing/content/messages'
import { useRecordedChat } from './useRecordedChat'

/** How much of the panel must be on screen before the turn plays by itself. */
const AUTOPLAY_THRESHOLD = 0.6

const messages = useLandingMessages()
const { messages: transcript, status, running, played, play } = useRecordedChat(
  useEditorStore(),
  () => messages.value.stage.ai
)

// Plays once when the visitor reaches the block, not while it mounts a screen ahead.
const root = ref<HTMLElement | null>(null)
const { stop } = useIntersectionObserver(
  root,
  ([entry]) => {
    if (!entry?.isIntersecting) return
    stop()
    void play()
  },
  { threshold: AUTOPLAY_THRESHOLD }
)
</script>

<template>
  <section ref="root" class="flex min-h-0 flex-1 flex-col bg-panel" aria-label="AI chat">
    <header
      class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 text-[11px] font-semibold text-surface"
    >
      <icon-lucide-sparkles class="size-3.5 text-muted" aria-hidden="true" />
      AI
      <span class="ml-auto font-normal text-muted">{{ messages.stage.ai.recorded }}</span>
    </header>
    <ChatTranscript :messages="transcript" :status="status" />
    <div class="flex shrink-0 justify-end border-t border-border px-3 py-2">
      <AppButton variant="outline" size="xs" shape="pill" :disabled="running" @click="play">
        <template #leading>
          <IconRotateCcw v-if="played" />
          <IconPlay v-else />
        </template>
        {{ played ? messages.stage.ai.replay : messages.stage.ai.play }}
      </AppButton>
    </div>
  </section>
</template>
