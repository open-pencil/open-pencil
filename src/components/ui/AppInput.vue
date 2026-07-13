<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import theme from '@/theme/input'

interface AppInputProps {
  type?: 'text' | 'password' | 'number' | 'search'
  placeholder?: string
  readonly?: boolean
  disabled?: boolean
  autofocus?: boolean
  min?: number
  max?: number
  step?: number
  tone?: 'default' | 'panel'
  size?: 'sm' | 'md'
  state?: 'idle' | 'mixed' | 'bound' | 'invalid'
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
  tone = 'default',
  size = 'md',
  state = 'idle'
} = defineProps<AppInputProps>()

const inputClass = computed(() => tv(theme)({ tone, size, state }))

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
    :placeholder="placeholder"
    :readonly="readonly"
    :disabled="disabled"
    :autofocus="autofocus"
    :min="min"
    :max="max"
    :step="step"
    :class="inputClass"
    @change="emit('change')"
    @keydown.enter="emit('enter', $event)"
    @focus="emit('focus', $event)"
  />
</template>
