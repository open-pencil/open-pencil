<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot } from 'reka-ui'
import { computed, useAttrs } from 'vue'

import { useDialogUI, type DialogUI, type DialogVariants } from '@/components/ui/dialog/ui'

defineOptions({ inheritAttrs: false })

const {
  size = 'md',
  height = 'auto',
  ui
} = defineProps<{
  size?: DialogVariants['size']
  height?: DialogVariants['height']
  ui?: DialogUI
}>()

const emit = defineEmits<{
  escapeKeyDown: [event: KeyboardEvent]
  pointerDownOutside: [event: Event]
  interactOutside: [event: Event]
}>()

const open = defineModel<boolean>('open', { default: false })
const attrs = useAttrs()
const cls = computed(() => useDialogUI(ui, { size, height }))
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay data-slot="dialog-overlay" :class="cls.overlay" />
      <DialogContent
        v-bind="attrs"
        data-slot="dialog-content"
        :class="cls.content"
        @escape-key-down="emit('escapeKeyDown', $event)"
        @pointer-down-outside="emit('pointerDownOutside', $event)"
        @interact-outside="emit('interactOutside', $event)"
      >
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
