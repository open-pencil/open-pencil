<script lang="ts">
import type { VNode } from 'vue'

import type { ComponentUI } from '@/components/ui/types'
import type { SegmentedControlTheme } from '@/theme/segmented-control'

export interface SegmentedControlOption {
  value: string
  label: string
  disabled?: boolean
}

export type SegmentedControlUI = ComponentUI<SegmentedControlTheme>

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  label?: string
  size?: keyof SegmentedControlTheme['variants']['size']
  ui?: SegmentedControlUI
}

export interface SegmentedControlSlots {
  option?(props: { option: SegmentedControlOption; selected: boolean }): VNode[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import { SegmentedControlItem, SegmentedControlRoot } from '@open-pencil/vue'

import theme from '@/theme/segmented-control'

const { options, label, size = 'sm', ui } = defineProps<SegmentedControlProps>()
defineSlots<SegmentedControlSlots>()
const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ change: [value: string] }>()

const styles = computed(() => tv(theme)({ size }))

function select(value: string | string[] | undefined) {
  if (typeof value !== 'string') return
  modelValue.value = value
  emit('change', value)
}
</script>

<template>
  <SegmentedControlRoot
    :model-value="modelValue"
    :aria-label="label"
    :class="styles.root({ class: ui?.root })"
    @update:model-value="select"
  >
    <SegmentedControlItem
      v-for="option in options"
      :key="option.value"
      v-slot="{ selected }"
      :value="option.value"
      :aria-label="option.label"
      :disabled="option.disabled"
      :class="styles.item({ class: ui?.item })"
    >
      <slot name="option" :option="option" :selected="selected">
        <span class="truncate">{{ option.label }}</span>
      </slot>
    </SegmentedControlItem>
  </SegmentedControlRoot>
</template>
