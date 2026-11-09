<script setup lang="ts">
import type { ToolbarAlign, ToolbarSide } from '@open-pencil/vue/primitives/Toolbar'

import type { ToolbarAction } from '@/app/editor/toolbar/layout'
import InsertIconButton from '@/components/icon-picker/InsertIconButton.vue'
import type { ToolbarUI } from '@/components/toolbar/types'

/**
 * A command's toolbar button. `anchored` mounts only its picker, over the toolbar, for a command
 * the toolbar hides that the menu and the palette still open.
 */
const {
  action,
  side,
  align,
  ui,
  mobile = false,
  anchored = false
} = defineProps<{
  action: ToolbarAction
  side?: ToolbarSide
  align?: ToolbarAlign
  ui?: ToolbarUI
  mobile?: boolean
  anchored?: boolean
}>()
</script>

<template>
  <InsertIconButton
    v-if="action === 'insert-icon'"
    :side="side"
    :align="align"
    :ui="ui"
    :mobile="mobile"
    :anchored="anchored"
  />
</template>
