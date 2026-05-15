<script setup lang="ts">
import Tip from '@/components/ui/Tip.vue'
import ToolButton from '@/components/Toolbar/ToolButton.vue'
import ToolFlyout from '@/components/Toolbar/ToolFlyout.vue'
import { toolbarToolTestId, ToolbarItem } from '@open-pencil/vue'

import type { Tool } from '@open-pencil/vue'
import type { EditorToolDef } from '@open-pencil/core/editor'
import type { ToolbarUi, ToolIconMap, ToolLabels } from '@/components/Toolbar/types'

const { tools, activeTool, toolIcons, toolLabels, toolShortcuts, ui } = defineProps<{
  tools: EditorToolDef[]
  activeTool: Tool
  toolIcons: ToolIconMap
  toolLabels: ToolLabels
  toolShortcuts: Record<Tool, string>
  ui?: ToolbarUi
}>()

const emit = defineEmits<{
  setTool: [tool: Tool]
}>()

function isActive(tool: EditorToolDef) {
  return tool.key === activeTool || (tool.flyout?.includes(activeTool) ?? false)
}

function activeKeyForTool(tool: EditorToolDef) {
  return tool.flyout?.includes(activeTool) ? activeTool : tool.key
}
</script>

<template>
  <div class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center">
    <div
      data-test-id="toolbar"
      class="flex gap-0.5 rounded-xl border border-border bg-panel p-1 shadow-lg"
    >
      <template v-for="tool in tools" :key="tool.key">
        <Tip
          v-if="tool.flyout && tool.flyout.length > 1"
          :label="`${toolLabels[activeKeyForTool(tool)]} (${tool.shortcut})`"
        >
          <ToolFlyout
            :tool="tool"
            :active-tool="activeTool"
            :tool-icons="toolIcons"
            :tool-labels="toolLabels"
            :tool-shortcuts="toolShortcuts"
            :ui="ui"
            @select="emit('setTool', $event)"
          />
        </Tip>

        <ToolbarItem v-else v-slot="{ active, actions }" :tool="tool.key">
          <Tip :label="`${toolLabels[tool.key]} (${tool.shortcut})`">
            <ToolButton
              :test-id="toolbarToolTestId(tool.key)"
              :icon="toolIcons[tool.key]"
              :active="active || isActive(tool)"
              @click="actions.select"
            />
          </Tip>
        </ToolbarItem>
      </template>
    </div>
  </div>
</template>
