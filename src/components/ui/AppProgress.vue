<script setup lang="ts">
import { computed } from 'vue'
import { ProgressIndicator, ProgressRoot } from 'reka-ui'
import { tv, type ClassValue } from 'tailwind-variants'

import theme from '@/theme/progress'

type ProgressSize = keyof typeof theme.variants.size
type ProgressTone = keyof typeof theme.variants.tone

const {
  value,
  max = 100,
  label,
  size = 'sm',
  tone = 'accent',
  class: className
} = defineProps<{
  value: number
  max?: number
  label: string
  size?: ProgressSize
  tone?: ProgressTone
  class?: ClassValue
}>()

const normalizedMax = computed(() => (Number.isFinite(max) && max > 0 ? max : 100))
const normalizedValue = computed(() =>
  Math.min(normalizedMax.value, Math.max(0, Number.isFinite(value) ? value : 0))
)
const percentage = computed(() => (normalizedValue.value / normalizedMax.value) * 100)
const styles = computed(() => tv(theme)({ size, tone }))
</script>

<template>
  <ProgressRoot
    :model-value="normalizedValue"
    :max="normalizedMax"
    :aria-label="label"
    :class="styles.root({ class: className })"
  >
    <ProgressIndicator
      :class="styles.indicator()"
      :style="{ transform: `translateX(-${100 - percentage}%)` }"
    />
  </ProgressRoot>
</template>
