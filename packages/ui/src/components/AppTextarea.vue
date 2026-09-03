<script setup lang="ts">
import { computed } from 'vue'

import { textareaTheme, type TextareaSize } from '#ui/theme/form'

const { size = 'sm', invalid = false } = defineProps<{
  size?: TextareaSize
  invalid?: boolean
}>()

const model = defineModel<string>({ default: '' })
const textareaClass = computed(() => textareaTheme({ size, invalid }))
</script>

<template>
  <textarea
    v-model="model"
    data-slot="textarea"
    :aria-invalid="invalid ? 'true' : undefined"
    :class="textareaClass"
  />
</template>
