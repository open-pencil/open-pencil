<script setup lang="ts">
import { ref, computed } from 'vue'
import { EDITOR_TOOLS } from '@open-pencil/core/editor'

import { useEditor } from '../shared/editorContext'
import { provideToolbar } from './context'

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
    :set-tool="setTool"
    :toggle-flyout="toggleFlyout"
    :close-flyout="closeFlyout"
  />
</template>
