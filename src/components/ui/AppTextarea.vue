<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import theme from '@/theme/textarea'

const model = defineModel<string>({ default: '' })

const { rows = 3, disabled = false } = defineProps<{ rows?: number; disabled?: boolean }>()
const textareaClass = computed(() => tv(theme)())
</script>

<template>
  <textarea v-model="model" :rows="rows" :disabled="disabled" :class="textareaClass" />
</template>
