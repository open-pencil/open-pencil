<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import theme from '@/theme/input'

interface AppInputProps {
  id?: string
  type?: 'text' | 'password' | 'number' | 'search'
  placeholder?: string
  ariaLabel?: string
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
  id,
  type = 'text',
  placeholder,
  ariaLabel,
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
    :id="id"
    v-model="modelValue"
    :type="type"
    :placeholder="placeholder"
    :aria-label="ariaLabel"
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
