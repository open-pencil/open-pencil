<script setup lang="ts">
import type { TestIdProps } from '@inkly/vue'

import { useInputUI } from '@/components/ui/input'

interface AppInputProps extends TestIdProps {
  type?: 'text' | 'password' | 'number' | 'search'
  placeholder?: string
  readonly?: boolean
  disabled?: boolean
  autofocus?: boolean
  min?: number
  max?: number
  step?: number
  ui?: {
    base?: string
  }
  size?: 'sm' | 'md'
}

const {
  type = 'text',
  placeholder,
  readonly,
  disabled,
  autofocus,
  min,
  max,
  step,
  ui,
  size = 'md',
  testId
} = defineProps<AppInputProps>()

const modelValue = defineModel<string | number>({ required: true })
const emit = defineEmits<{
  change: []
  enter: [event: KeyboardEvent]
  focus: [event: FocusEvent]
}>()
</script>

<template>
  <input
    v-model="modelValue"
    :type="type"
    :data-test-id="testId"
    :placeholder="placeholder"
    :readonly="readonly"
    :disabled="disabled"
    :autofocus="autofocus"
    :min="min"
    :max="max"
    :step="step"
    :class="useInputUI({ size, ui }).base"
    @change="emit('change')"
    @keydown.enter="emit('enter', $event)"
    @focus="emit('focus', $event)"
  />
</template>
