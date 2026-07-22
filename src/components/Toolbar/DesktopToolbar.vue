<script setup lang="ts">
import Tip from '@/components/ui/Tip.vue'
import ToolButton from '@/components/Toolbar/ToolButton.vue'
import ToolFlyout from '@/components/Toolbar/ToolFlyout.vue'
import {
  getToolbarToolSelection,
  isToolbarToolActive,
  toolbarToolTestId,
  ToolbarItem
} from '@open-pencil/vue'

import type { Tool } from '@open-pencil/vue'
import type { EditorToolDef } from '@open-pencil/core/editor'
import type { ToolbarUI, ToolIconMap, ToolLabels } from '@/components/Toolbar/types'

const { tools, activeTool, flyoutSelections, toolIcons, toolLabels, toolShortcuts, ui } =
  defineProps<{
    tools: EditorToolDef[]
    activeTool: Tool
    flyoutSelections: ReadonlyMap<Tool, Tool>
    toolIcons: ToolIconMap
    toolLabels: ToolLabels
    toolShortcuts: Record<Tool, string>
    ui?: ToolbarUI
  }>()

const emit = defineEmits<{
  setTool: [tool: Tool]
}>()
</script>

<template>
  <div class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center">
    <div
      data-test-id="toolbar"
      class="flex gap-0.5 rounded-xl bg-panel p-1 shadow-[0_8px_30px_rgb(0_0_0/0.4)]"
    >
      <template v-for="tool in tools" :key="tool.key">
        <Tip
          v-if="tool.flyout && tool.flyout.length > 1"
          :label="`${toolLabels[getToolbarToolSelection(tool, activeTool, flyoutSelections)]} (${tool.shortcut})`"
        >
          <ToolFlyout
            :tool="tool"
            :active-tool="activeTool"
            :selected-tool="getToolbarToolSelection(tool, activeTool, flyoutSelections)"
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
              :data-test-id="toolbarToolTestId(tool.key)"
              :icon="toolIcons[tool.key]"
              :label="toolLabels[tool.key]"
              :active="active || isToolbarToolActive(tool, activeTool)"
              :ui="ui"
              @click="actions.select"
            />
          </Tip>
        </ToolbarItem>
      </template>
    </div>
  </div>
</template>
