<script setup lang="ts">
import { computed } from 'vue'

import { inputTheme, type InputSize } from '#ui/theme/form'

const {
  type = 'text',
  size = 'md',
  invalid = false
} = defineProps<{
  type?: 'text' | 'email' | 'password' | 'search' | 'url' | 'number'
  size?: InputSize
  invalid?: boolean
}>()

const model = defineModel<string | number>({ required: true })
const inputClass = computed(() => inputTheme({ size, invalid }))
</script>

<template>
  <input
    v-model="model"
    data-slot="input"
    :type="type"
    :aria-invalid="invalid ? 'true' : undefined"
    :class="inputClass"
  />
</template>
