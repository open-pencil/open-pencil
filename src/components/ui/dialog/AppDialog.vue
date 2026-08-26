<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue'

import AppDialogBody from './AppDialogBody.vue'
import AppDialogFooter from './AppDialogFooter.vue'
import AppDialogHeader from './AppDialogHeader.vue'
import AppDialogRoot from './AppDialogRoot.vue'
import type { DialogUI, DialogVariants } from './ui'

const {
  heading,
  description,
  closeLabel,
  showClose = true,
  size = 'md',
  height = 'auto',
  ui
} = defineProps<{
  heading?: string
  description?: string
  closeLabel?: string
  showClose?: boolean
  size?: DialogVariants['size']
  height?: DialogVariants['height']
  ui?: DialogUI
}>()

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const open = defineModel<boolean>('open', { default: false })
const slots = useSlots()
const hasHeader = computed(() =>
  Boolean(heading || description || slots.header || slots.title || slots.description)
)
</script>

<template>
  <AppDialogRoot v-bind="attrs" v-model:open="open" :size="size" :height="height" :ui="ui">
    <slot v-if="slots.header" name="header" />
    <AppDialogHeader
      v-else-if="hasHeader"
      :heading="heading ?? ''"
      :description="description"
      :close-label="closeLabel"
      :show-close="showClose"
      :ui="ui"
    >
      <template #title><slot name="title" /></template>
      <template #description><slot name="description" /></template>
      <template #actions><slot name="header-actions" /></template>
      <template #close-icon><slot name="close-icon" /></template>
    </AppDialogHeader>
    <AppDialogBody v-if="$slots.default" :ui="ui"><slot /></AppDialogBody>
    <AppDialogFooter v-if="$slots.footer" :ui="ui"><slot name="footer" /></AppDialogFooter>
  </AppDialogRoot>
</template>
