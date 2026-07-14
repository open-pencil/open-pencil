<script lang="ts">
import type { HTMLAttributes } from 'vue'

import type { BindingFieldUI } from './ui'

export interface BindingPillProps {
  label: string
  tooltip?: string
  disabled?: boolean
  derived?: boolean
  class?: HTMLAttributes['class']
  ui?: BindingFieldUI
}
</script>

<script setup lang="ts">
import { computed, normalizeClass } from 'vue'

import Tip from '@/components/ui/Tip.vue'
import { useBindingFieldUI } from '@/components/ui/binding/ui'

const {
  label,
  tooltip,
  disabled = false,
  derived = false,
  class: className,
  ui
} = defineProps<BindingPillProps>()

const styles = computed(() =>
  useBindingFieldUI(
    { state: 'bound', disabled, derived },
    { ...ui, pill: [ui?.pill, normalizeClass(className)].filter(Boolean).join(' ') }
  )
)

defineOptions({ inheritAttrs: false })
</script>

<template>
  <Tip :label="tooltip" :disabled="!tooltip">
    <span
      v-bind="$attrs"
      :class="styles.pill"
      :data-disabled="disabled ? '' : undefined"
      :data-derived="derived ? '' : undefined"
      data-slot="pill"
    >
      <span :class="styles.pillLabel">{{ label }}</span>
    </span>
  </Tip>
</template>
