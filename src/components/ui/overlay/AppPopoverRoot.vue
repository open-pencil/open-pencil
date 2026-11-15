<script setup lang="ts">
import { PopoverRoot } from 'reka-ui'
import { computed, ref } from 'vue'

import { useOverlayOpen, type OverlayKind } from '@open-pencil/vue/lifecycle/overlays'

// Reka's popover root, counted as an open overlay while it is open. Like Reka's root, an `open`
// the parent passes decides, and without one the popover keeps its own, from `defaultOpen`. Its
// other props, such as `modal`, fall through to the root as given, so Reka's defaults hold.
const {
  open = undefined,
  defaultOpen = false,
  overlayKind = 'overlay',
  holdsKeys = true
} = defineProps<{
  open?: boolean
  defaultOpen?: boolean
  /** `picker` for a fill or colour picker, which leaves undo and redo to the document. */
  overlayKind?: OverlayKind
  /**
   * False for a bar that shows beside the canvas without taking focus, such as FigJam's
   * selection toolbar, so the canvas's shortcuts and nudging keep working while it shows.
   */
  holdsKeys?: boolean
}>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
const ownOpen = ref(defaultOpen)
const shown = computed(() => open ?? ownOpen.value)
useOverlayOpen(() => holdsKeys && shown.value, overlayKind)

function updateOpen(value: boolean) {
  ownOpen.value = value
  emit('update:open', value)
}
</script>

<template>
  <PopoverRoot :open="shown" @update:open="updateOpen">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverRoot>
</template>
