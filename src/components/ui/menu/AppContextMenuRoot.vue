<script setup lang="ts">
import { ContextMenuRoot } from 'reka-ui'
import { ref } from 'vue'

import { useOverlayOpen } from '@open-pencil/vue/lifecycle/overlays'

// Reka's context menu root, counted as an open overlay while it is open. Reka opens a context
// menu itself and only reports it, so the root follows `update:open`. Its other props, such as
// `modal`, fall through to the root as given, so Reka's defaults hold.
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
const open = ref(false)
useOverlayOpen(open)

function updateOpen(value: boolean) {
  open.value = value
  emit('update:open', value)
}
</script>

<template>
  <ContextMenuRoot @update:open="updateOpen">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </ContextMenuRoot>
</template>
