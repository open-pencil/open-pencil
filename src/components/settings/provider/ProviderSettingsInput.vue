<script setup lang="ts">
import { useTemplateRef } from 'vue'

import AppInput from '@/components/ui/input/AppInput.vue'

/**
 * The text field of every Settings form, so fields read alike beside the selects they sit with.
 * Everything else, such as type, placeholder, autocomplete and listeners, passes through to
 * `AppInput`.
 */
const modelValue = defineModel<string | number>({ required: true })
const input = useTemplateRef('input')
defineExpose({ focus: (options?: FocusOptions) => input.value?.focus(options) })
</script>

<template>
  <AppInput ref="input" v-model="modelValue" size="sm" tone="panel" />
</template>
