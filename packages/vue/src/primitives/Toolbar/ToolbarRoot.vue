<script setup lang="ts">
import { ref, computed } from 'vue'
import { EDITOR_TOOLS } from '@open-pencil/core/editor'

import { useEditor } from '#vue/editor/context'
import { provideToolbar } from '#vue/primitives/Toolbar/context'

import type { EditorToolDef, Tool } from '@open-pencil/core/editor'

const { tools = EDITOR_TOOLS } = defineProps<{
  tools?: EditorToolDef[]
}>()

const editor = useEditor()
const activeTool = computed(() => editor.state.activeTool)
const expandedFlyout = ref<Tool | null>(null)

function setTool(tool: Tool) {
  editor.setTool(tool)
  expandedFlyout.value = null
}

function toggleFlyout(tool: Tool) {
  expandedFlyout.value = expandedFlyout.value === tool ? null : tool
}

function closeFlyout() {
  expandedFlyout.value = null
}

const actions = {
  setTool,
  toggleFlyout,
  closeFlyout
}

provideToolbar({
  editor,
  tools,
  activeTool,
  expandedFlyout,
  setTool,
  toggleFlyout,
  closeFlyout
})
</script>

<template>
  <slot
    :tools="tools"
    :active-tool="activeTool"
    :expanded-flyout="expandedFlyout"
    :actions="actions"
  />
</template>
