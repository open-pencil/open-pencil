<script setup lang="ts">
// Adapted from ai-elements-vue — reka-ui instead of @repo/shadcn-vue/collapsible
import type { HTMLAttributes } from 'vue'
import { CollapsibleRoot } from 'reka-ui'
import { useVModel } from '@vueuse/core'
import { computed, provide, ref, watch } from 'vue'
import { cn } from '../utils'
import { ReasoningKey } from './context'

interface Props {
  class?: HTMLAttributes['class']
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  defaultOpen: true,
  duration: undefined,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'update:duration', value: number): void
}>()

const isOpen = useVModel(props, 'open', emit, {
  defaultValue: props.defaultOpen,
  passive: true,
})

const internalDuration = ref<number | undefined>(props.duration)

watch(() => props.duration, (newVal) => {
  internalDuration.value = newVal
})

function updateDuration(val: number) {
  internalDuration.value = val
  emit('update:duration', val)
}

const hasAutoClosed = ref(false)
const startTime = ref<number | null>(null)

const MS_IN_S = 1000
const AUTO_CLOSE_DELAY = 1000

watch(() => props.isStreaming, (streaming) => {
  if (streaming) {
    isOpen.value = true
    if (startTime.value === null && props.duration === undefined) {
      startTime.value = Date.now()
    }
  } else if (startTime.value !== null) {
    const calculatedDuration = Math.ceil((Date.now() - startTime.value) / MS_IN_S)
    updateDuration(calculatedDuration)
    startTime.value = null
  }
}, { immediate: true })

watch([() => props.isStreaming, isOpen, () => props.defaultOpen, hasAutoClosed], (_, __, onCleanup) => {
  if (props.defaultOpen && !props.isStreaming && isOpen.value && !hasAutoClosed.value) {
    const timer = setTimeout(() => {
      isOpen.value = false
      hasAutoClosed.value = true
    }, AUTO_CLOSE_DELAY)
    onCleanup(() => clearTimeout(timer))
  }
}, { immediate: true })

provide(ReasoningKey, {
  isStreaming: computed(() => props.isStreaming),
  isOpen,
  setIsOpen: (val: boolean) => { isOpen.value = val },
  duration: computed(() => internalDuration.value),
})
</script>

<template>
  <CollapsibleRoot
    v-model:open="isOpen"
    :class="cn('not-prose mb-2', props.class)"
  >
    <slot />
  </CollapsibleRoot>
</template>
