<script setup lang="ts">
import { DropdownMenuRoot } from 'reka-ui'
import { computed, ref } from 'vue'

import { useOverlayOpen } from '@open-pencil/vue/lifecycle/overlays'

// Reka's dropdown menu root, counted as an open overlay while it is open. Like Reka's root, an
// `open` the parent passes decides, and without one the menu keeps its own, from `defaultOpen`.
// Its other props, such as `modal`, fall through to the root as given, so Reka's defaults hold.
const { open = undefined, defaultOpen = false } = defineProps<{
  open?: boolean
  defaultOpen?: boolean
}>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
const ownOpen = ref(defaultOpen)
const shown = computed(() => open ?? ownOpen.value)
useOverlayOpen(shown)

function updateOpen(value: boolean) {
  ownOpen.value = value
  emit('update:open', value)
}
</script>

<template>
  <DropdownMenuRoot :open="shown" @update:open="updateOpen">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DropdownMenuRoot>
</template>
