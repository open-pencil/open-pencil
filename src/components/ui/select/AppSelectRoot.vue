<script setup lang="ts">
import { SelectRoot } from 'reka-ui'
import { computed, ref } from 'vue'

import { useOverlayOpen } from '@open-pencil/vue/lifecycle/overlays'

// Reka's select root, counted as an open overlay while its list is open. Like Reka's root, an
// `open` the parent passes decides, and without one the select keeps its own, from
// `defaultOpen`. Its value and other props fall through to the root as given.
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
  <SelectRoot :open="shown" @update:open="updateOpen">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </SelectRoot>
</template>
