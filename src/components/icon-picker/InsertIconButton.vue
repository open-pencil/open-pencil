<script setup lang="ts">
import IconSmilePlus from '~icons/lucide/smile-plus'

import { usePanelMessages } from '@open-pencil/vue/i18n'

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
  anchored = false
} = defineProps<{ ui?: ToolbarUI; mobile?: boolean; anchored?: boolean }>()
const store = useEditorStore()
const panels = usePanelMessages()

function insert(name: string) {
  store.insertIcon(name).catch(() => toast.error(panels.value.insertIconFailed))
}
</script>

<template>
  <IconPicker
    v-model:open="store.state.iconPickerOpen"
    :heading="panels.insertIcon"
    :tooltip="panels.insertIcon"
    side="top"
    align="center"
    @select="insert"
  >
    <template v-if="anchored" #anchor>
      <span aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0" />
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
