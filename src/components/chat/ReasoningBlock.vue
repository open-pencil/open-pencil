<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  text: string
  isStreaming?: boolean
}>()

const isOpen = ref(props.isStreaming ?? false)
const durationSeconds = ref<number>()
const startTime = ref<number>()
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.isStreaming,
  (streaming) => {
    if (streaming) {
      // Open when streaming starts
      if (!isOpen.value) isOpen.value = true
      if (!startTime.value) startTime.value = Date.now()
    } else if (startTime.value) {
      // Compute duration, schedule auto-close
      durationSeconds.value = Math.ceil((Date.now() - startTime.value) / 1000)
      startTime.value = undefined
      autoCloseTimer = setTimeout(() => {
        isOpen.value = false
        autoCloseTimer = null
      }, 1000)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (autoCloseTimer) clearTimeout(autoCloseTimer)
})

const label = computed(() => {
  if (props.isStreaming) return 'Thinking…'
  if (durationSeconds.value !== undefined) return `Thought for ${durationSeconds.value}s`
  return 'Reasoning'
})
</script>

<template>
  <CollapsibleRoot v-model:open="isOpen" class="rounded-lg border border-border bg-canvas">
    <CollapsibleTrigger
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-muted transition-colors hover:text-surface"
    >
      <icon-lucide-brain class="size-3.5 shrink-0 text-accent/70" />
      <span class="flex-1">
        <span v-if="isStreaming" class="inline-flex items-center gap-1">
          <span
            v-for="n in 3"
            :key="n"
            class="inline-block size-1 animate-bounce rounded-full bg-muted"
            :style="{ animationDelay: `${(n - 1) * 150}ms` }"
          />
          {{ label }}
        </span>
        <span v-else>{{ label }}</span>
      </span>
      <icon-lucide-chevron-down
        class="size-3 shrink-0 text-muted transition-transform [[data-state=open]>&]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent
      class="overflow-hidden text-[11px] leading-relaxed text-muted data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
    >
      <div class="border-t border-border px-3 py-2 italic">{{ text }}</div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
