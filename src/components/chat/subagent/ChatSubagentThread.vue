<script setup lang="ts">
import type { UIMessage } from 'ai'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { SubagentTranscript } from '@/app/ai/chat/subagents'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import { chatSubagentTheme } from '@/components/chat/ui'

/** What a subagent was asked and what it did, as a reply of its own that cannot be answered. */
const { transcript } = defineProps<{ transcript: SubagentTranscript }>()

const { ai } = useI18n()
const ui = chatSubagentTheme()

const message = computed<UIMessage>(() => ({
  id: `subagent-${transcript.session}`,
  role: 'assistant',
  parts: transcript.parts
}))
const working = computed(() => transcript.state === undefined || transcript.state === 'running')
</script>

<template>
  <div v-if="transcript.title || transcript.description" :class="ui.intro()">
    <p v-if="transcript.title" :class="ui.introTitle()">{{ transcript.title }}</p>
    <p v-if="transcript.description" :class="ui.introDescription()">
      {{ transcript.description }}
    </p>
  </div>
  <ScrollAreaRoot class="relative min-h-0 flex-1">
    <ScrollAreaViewport class="h-full" data-test-id="chat-subagent-thread">
      <div v-if="transcript.parts.length" :class="ui.transcript()">
        <ChatMessage :message="message" :streaming="working" />
      </div>
      <p v-else :class="ui.empty()">{{ ai.subagentEmpty }}</p>
    </ScrollAreaViewport>
    <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
      <ScrollAreaThumb class="relative flex-1 rounded-full bg-muted/30" />
    </ScrollAreaScrollbar>
  </ScrollAreaRoot>
</template>
