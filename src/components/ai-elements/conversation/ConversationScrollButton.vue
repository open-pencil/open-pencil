<script setup lang="ts">
// Adapted from ai-elements-vue — inline button instead of shadcn Button, lucide-vue-next
import type { HTMLAttributes } from 'vue'
import { ArrowDownIcon } from 'lucide-vue-next'
import { computed } from 'vue'
import { useStickToBottomContext } from 'vue-stick-to-bottom'
import { cn } from '../utils'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const { isAtBottom, scrollToBottom } = useStickToBottomContext()
const showScrollButton = computed(() => !isAtBottom.value)
</script>

<template>
  <Transition name="fade">
    <button
      v-if="showScrollButton"
      :class="cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full',
        'border border-border bg-panel px-3 py-1.5 text-[11px] text-muted shadow-lg',
        'hover:bg-hover hover:text-surface transition-colors',
        props.class,
      )"
      aria-label="Scroll to bottom"
      type="button"
      v-bind="$attrs"
      @click="scrollToBottom()"
    >
      <ArrowDownIcon class="size-3" />
      Scroll to bottom
    </button>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
