<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import type { ReasoningDisplay } from '@/app/settings/preferences/store'
import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'
import { collapsibleContentMotion } from '@/theme/collapsible/collapsible'

const {
  display = 'collapsed',
  text,
  streaming = false,
  thinkingLabel,
  reasoningLabel
} = defineProps<{
  display?: ReasoningDisplay
  text: string
  streaming?: boolean
  thinkingLabel: string
  reasoningLabel: string
}>()

const open = ref(display === 'expanded' || (display === 'while-thinking' && streaming))
const userChangedOpen = ref(false)
const markdownMode = computed(() => (streaming ? 'streaming' : 'static'))
const { start: scheduleClose, stop: cancelClose } = useTimeoutFn(
  () => {
    if (display === 'while-thinking' && !streaming && !userChangedOpen.value) open.value = false
  },
  1000,
  { immediate: false }
)

watch(
  () => streaming,
  (isStreaming, wasStreaming) => {
    cancelClose()
    if (userChangedOpen.value) return
    if (isStreaming) {
      open.value = display !== 'collapsed'
    } else if (wasStreaming && display === 'while-thinking') {
      scheduleClose()
    }
  }
)

watch(
  () => display,
  () => {
    cancelClose()
    if (!userChangedOpen.value)
      open.value = display === 'expanded' || (display === 'while-thinking' && streaming)
  }
)

function updateOpen(value: boolean): void {
  open.value = value
  userChangedOpen.value = true
  cancelClose()
}
</script>

<template>
  <CollapsibleRoot
    :open="open"
    :unmount-on-hide="false"
    class="rounded-lg border border-border bg-canvas"
    @update:open="updateOpen"
  >
    <CollapsibleTrigger
      data-slot="chat-reasoning-trigger"
      class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-muted hover:bg-hover hover:text-surface"
    >
      <icon-lucide-brain class="size-3.5 shrink-0 text-accent" aria-hidden="true" />
      <span class="flex-1">{{ streaming ? thinkingLabel : reasoningLabel }}</span>
      <icon-lucide-loader-circle
        v-if="streaming"
        class="size-3 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <icon-lucide-chevron-down
        v-else
        class="size-3 transition-transform motion-reduce:transition-none [[data-state=open]>&]:rotate-180"
        aria-hidden="true"
      />
    </CollapsibleTrigger>
    <CollapsibleContent data-slot="chat-reasoning-content" :class="collapsibleContentMotion">
      <div class="border-t border-border px-2 py-1.5 text-[11px] leading-relaxed text-muted">
        <ChatMarkdown :content="text" :mode="markdownMode" surface="reasoning" />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
