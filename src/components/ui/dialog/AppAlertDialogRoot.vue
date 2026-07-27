<script setup lang="ts">
import { AlertDialogContent, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot } from 'reka-ui'
import { computed, useAttrs } from 'vue'

import { useDialogUI, type DialogUI, type DialogVariants } from '@/components/ui/dialog/ui'

defineOptions({ inheritAttrs: false })

const {
  size = 'sm',
  height = 'auto',
  ui
} = defineProps<{
  size?: DialogVariants['size']
  height?: DialogVariants['height']
  ui?: DialogUI
}>()

const emit = defineEmits<{
  escapeKeyDown: [event: KeyboardEvent]
  overlayClick: [event: MouseEvent]
}>()

const open = defineModel<boolean>('open', { default: false })
const attrs = useAttrs()
const cls = computed(() => useDialogUI(ui, { size, height }))
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="open = $event">
    <AlertDialogPortal>
      <AlertDialogOverlay
        data-slot="alert-dialog-overlay"
        :class="cls.overlay"
        @click="emit('overlayClick', $event)"
      />
      <AlertDialogContent
        v-bind="attrs"
        data-slot="alert-dialog-content"
        :class="cls.content"
        @escape-key-down="emit('escapeKeyDown', $event)"
      >
        <slot />
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
