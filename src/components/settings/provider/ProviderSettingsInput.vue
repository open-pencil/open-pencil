<script setup lang="ts">
import AppInput from '@/components/ui/AppInput.vue'

interface ProviderSettingsInputProps {
  type?: 'text' | 'password' | 'number'
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

const { type = 'text', placeholder, min, max, step } = defineProps<ProviderSettingsInputProps>()

const modelValue = defineModel<string | number>({ required: true })
const emit = defineEmits<{ change: [] }>()
</script>

<template>
  <AppInput
    v-model="modelValue"
    :type="type"
    :placeholder="placeholder"
    :min="min"
    :max="max"
    :step="step"
    size="sm"
    @change="emit('change')"
  />
</template>
