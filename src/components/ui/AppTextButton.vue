<script setup lang="ts">
import { computed } from 'vue'
import { twMerge } from 'tailwind-merge'
import type { TestIdProps } from '@inkly/vue'

interface AppTextButtonProps extends TestIdProps {
  ui?: {
    base?: string
  }
  size?: 'xs' | 'sm'
  underline?: boolean
}

const { ui, size = 'sm', underline = false, testId } = defineProps<AppTextButtonProps>()

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const cls = computed(() =>
  twMerge(
    'cursor-pointer text-muted hover:text-surface',
    size === 'xs' ? 'text-[9px]' : 'text-[10px]',
    underline && 'underline',
    ui?.base
  )
)
</script>

<template>
  <button type="button" :data-test-id="testId" :class="cls" @click="emit('click', $event)">
    <slot />
  </button>
</template>
