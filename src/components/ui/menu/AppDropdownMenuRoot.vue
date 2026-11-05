<script setup lang="ts">
import { DropdownMenuRoot } from 'reka-ui'

import { useOverlayOpen } from '@open-pencil/vue/lifecycle/overlays'

// Reka's dropdown menu root, counted as an open overlay while it is open. Its other props, such
// as `modal`, fall through to the root as given, so Reka's defaults hold.
const open = defineModel<boolean>('open', { default: false })
useOverlayOpen(open)
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DropdownMenuRoot>
</template>
