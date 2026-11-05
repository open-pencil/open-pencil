<script setup lang="ts">
import { PopoverRoot } from 'reka-ui'

import { useOverlayOpen } from '@open-pencil/vue/lifecycle/overlays'

// Reka's popover root, counted as an open overlay while it is open. Its other props, such as
// `modal`, fall through to the root as given, so Reka's defaults hold.
const open = defineModel<boolean>('open', { default: false })
useOverlayOpen(open)
</script>

<template>
  <PopoverRoot v-model:open="open">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverRoot>
</template>
