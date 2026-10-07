<script setup lang="ts">
import { ProgressIndicator, ProgressRoot } from 'reka-ui'
import { computed } from 'vue'

import {
  progress as progressTheme,
  progressPercent,
  type ProgressAmount,
  type ProgressTone,
  type ProgressUI
} from './progress'

const {
  amount,
  label,
  ariaLabel,
  tone = 'accent',
  class: className,
  ui
} = defineProps<{
  /** Omit `value` or `max` for work that cannot be measured. */
  amount: ProgressAmount
  /** Measurement text under the bar, formatted by the producing domain. */
  label?: string
  /** Names the bar for assistive technology; defaults to `label`. */
  ariaLabel?: string
  tone?: ProgressTone
  class?: string
  ui?: ProgressUI
}>()

const percent = computed(() => progressPercent(amount))
const styles = computed(() => {
  const theme = progressTheme({ tone })
  return {
    root: theme.root({ class: [className, ui?.root] }),
    track: theme.track({ class: ui?.track }),
    fill: theme.fill({ class: ui?.fill }),
    label: theme.label({ class: ui?.label })
  }
})
</script>

<template>
  <div data-slot="progress" :class="styles.root">
    <ProgressRoot
      :model-value="percent"
      :max="100"
      :aria-label="ariaLabel ?? label"
      :class="styles.track"
    >
      <ProgressIndicator
        data-slot="progress-fill"
        :class="styles.fill"
        :style="percent === null ? undefined : { width: `${percent}%` }"
      />
    </ProgressRoot>
    <p v-if="label" data-slot="progress-label" :class="styles.label">{{ label }}</p>
  </div>
</template>
