<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
const flyoutSelections = reactive(new Map<Tool, Tool>())

watch(
  activeTool,
  (currentTool) => {
    for (const tool of tools) {
      if (tool.flyout?.includes(currentTool)) {
        flyoutSelections.set(tool.key, currentTool)
      }
    }
  },
  { immediate: true }
)

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
  flyoutSelections,
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
    :flyout-selections="flyoutSelections"
    :expanded-flyout="expandedFlyout"
    :actions="actions"
  />
</template>
