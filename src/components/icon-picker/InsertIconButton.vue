<script setup lang="ts">
import { computed } from 'vue'
import IconSmilePlus from '~icons/lucide/smile-plus'

import { usePanelMessages } from '@open-pencil/vue/i18n'
import { toolbarPopupSide } from '@open-pencil/vue/primitives/Toolbar'
import type { ToolbarAlign, ToolbarSide } from '@open-pencil/vue/primitives/Toolbar'

import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import ToolButton from '@/components/toolbar/ToolButton.vue'
import type { ToolbarUI } from '@/components/toolbar/types'

import IconPicker from './IconPicker.vue'

/**
 * The toolbar's icon picker, also opened by the Insert Icon command. `anchored` mounts it without
 * its button, over the toolbar, while the button is hidden from it.
 */
const {
  ui,
  mobile = false,
  anchored = false,
  side = 'bottom',
  align = 'center'
} = defineProps<{
  ui?: ToolbarUI
  mobile?: boolean
  anchored?: boolean
  /** The canvas edge the toolbar is docked to; the picker opens away from it. */
  side?: ToolbarSide
  /** Where along its edge the toolbar sits; the picker lines up with the same end. */
  align?: ToolbarAlign
}>()
const store = useEditorStore()
const panels = usePanelMessages()
const popupSide = computed(() => toolbarPopupSide(side))
/** The anchor runs along the toolbar's edge that faces the canvas. */
const ANCHOR_EDGES = {
  top: 'inset-x-0 top-0',
  bottom: 'inset-x-0 bottom-0',
  left: 'inset-y-0 left-0',
  right: 'inset-y-0 right-0'
} as const

function insert(name: string) {
  store.insertIcon(name).catch(() => toast.error(panels.value.insertIconFailed))
}
</script>

<template>
  <IconPicker
    v-model:open="store.state.iconPickerOpen"
    :heading="panels.insertIcon"
    :tooltip="panels.insertIcon"
    :side="popupSide"
    :tooltip-side="popupSide"
    :align="align"
    @select="insert"
  >
    <template v-if="anchored" #anchor>
      <span
        aria-hidden="true"
        class="pointer-events-none absolute"
        :class="ANCHOR_EDGES[popupSide]"
      />
    </template>
    <template v-else #trigger>
      <ToolButton
        :icon="IconSmilePlus"
        :label="panels.insertIcon"
        :active="store.state.iconPickerOpen"
        :mobile="mobile"
        :ui="ui"
      />
    </template>
  </IconPicker>
</template>
