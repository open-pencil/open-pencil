<script setup lang="ts">
import type { TestIdProps } from '@inkly/vue'

import AppInput from '@/components/ui/AppInput.vue'

interface ProviderSettingsInputProps extends TestIdProps {
  type?: 'text' | 'password' | 'number'
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

const {
  type = 'text',
  placeholder,
  testId,
  min,
  max,
  step
} = defineProps<ProviderSettingsInputProps>()

const modelValue = defineModel<string | number>({ required: true })
const emit = defineEmits<{ change: [] }>()
</script>

<template>
  <AppInput
    v-model="modelValue"
    :type="type"
    :test-id="testId"
    :placeholder="placeholder"
    :min="min"
    :max="max"
    :step="step"
    size="sm"
    @change="emit('change')"
  />
</template>
