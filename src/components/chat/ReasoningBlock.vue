<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'

const {
  text,
  streaming = false,
  thinkingLabel,
  reasoningLabel
} = defineProps<{
  text: string
  streaming?: boolean
  thinkingLabel: string
  reasoningLabel: string
}>()

const open = ref(streaming)
const userChangedOpen = ref(false)
const markdownMode = computed(() => (streaming ? 'streaming' : 'static'))
const { start: scheduleClose, stop: cancelClose } = useTimeoutFn(
  () => {
    if (!streaming && !userChangedOpen.value) open.value = false
  },
  1000,
  { immediate: false }
)

watch(
  () => streaming,
  (isStreaming, wasStreaming) => {
    cancelClose()
    if (isStreaming) {
      userChangedOpen.value = false
      open.value = true
    } else if (wasStreaming) {
      scheduleClose()
    }
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
    class="rounded-lg border border-border bg-canvas"
    @update:open="updateOpen"
  >
    <CollapsibleTrigger
      data-slot="chat-reasoning-trigger"
      class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-muted hover:bg-hover hover:text-surface"
    >
      <icon-lucide-brain class="size-3.5 shrink-0 text-accent" aria-hidden="true" />
      <span class="flex-1">{{ streaming ? thinkingLabel : reasoningLabel }}</span>
      <icon-lucide-loader-circle v-if="streaming" class="size-3 animate-spin" aria-hidden="true" />
      <icon-lucide-chevron-down
        v-else
        class="size-3 transition-transform [[data-state=open]>&]:rotate-180"
        aria-hidden="true"
      />
    </CollapsibleTrigger>
    <CollapsibleContent
      data-slot="chat-reasoning-content"
      class="data-[state=closed]:collapsible-up data-[state=open]:collapsible-down overflow-hidden border-t border-border px-2 py-1.5 text-[11px] leading-relaxed text-muted"
    >
      <ChatMarkdown :content="text" :mode="markdownMode" surface="reasoning" />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
