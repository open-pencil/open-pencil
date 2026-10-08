<script setup lang="ts">
import IconSmilePlus from '~icons/lucide/smile-plus'

import { usePanelMessages } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import ToolButton from '@/components/Toolbar/ToolButton.vue'
import type { ToolbarUI } from '@/components/Toolbar/types'

import IconPicker from './IconPicker.vue'

/** The toolbar's icon picker, also opened by the Insert Icon command. */
const { ui, mobile = false } = defineProps<{ ui?: ToolbarUI; mobile?: boolean }>()
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
    <template #trigger>
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
