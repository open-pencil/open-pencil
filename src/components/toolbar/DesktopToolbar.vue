<script setup lang="ts">
import { ToolbarRoot } from 'reka-ui'

import {
  getToolbarToolSelection,
  isToolbarToolActive,
  toolbarToolTestId,
  ToolbarItem
} from '@open-pencil/vue'
import type { Tool } from '@open-pencil/vue'

import type { ToolbarAction, ToolbarItem as ToolbarLayoutItem } from '@/app/editor/toolbar/layout'
import { toolTip } from '@/app/editor/toolbar/shortcuts'
import ToolButton from '@/components/toolbar/ToolButton.vue'
import ToolFlyout from '@/components/toolbar/ToolFlyout.vue'
import type { ToolbarUI, ToolIconMap, ToolLabels } from '@/components/toolbar/types'
import Tip from '@/components/ui/overlay/Tip.vue'

const { items, activeTool, flyoutSelections, toolIcons, toolLabels, toolShortcuts, ui } =
  defineProps<{
    items: ToolbarLayoutItem[]
    activeTool: Tool
    flyoutSelections: ReadonlyMap<Tool, Tool>
    toolIcons: ToolIconMap
    toolLabels: ToolLabels
    toolShortcuts: Readonly<Record<Tool, string>>
    ui?: ToolbarUI
  }>()

const emit = defineEmits<{
  setTool: [tool: Tool]
}>()

defineSlots<{
  /** A button that runs a command, such as placing an icon, rather than picking a tool. */
  action(props: { action: ToolbarAction }): unknown
}>()
</script>

<template>
  <div
    data-canvas-obstacle
    class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center"
  >
    <ToolbarRoot
      data-test-id="toolbar"
      class="flex gap-0.5 rounded-xl bg-panel p-1 shadow-[0_8px_30px_rgb(0_0_0/0.4)]"
    >
      <template v-for="item in items" :key="item.kind === 'tool' ? item.tool.key : item.action">
        <slot v-if="item.kind === 'action'" name="action" :action="item.action" />

        <Tip
          v-else-if="item.tool.flyout"
          :label="
            toolTip(
              toolLabels[getToolbarToolSelection(item.tool, activeTool, flyoutSelections)],
              toolShortcuts[getToolbarToolSelection(item.tool, activeTool, flyoutSelections)]
            )
          "
        >
          <ToolFlyout
            :tool="item.tool"
            :active-tool="activeTool"
            :selected-tool="getToolbarToolSelection(item.tool, activeTool, flyoutSelections)"
            :tool-icons="toolIcons"
            :tool-labels="toolLabels"
            :tool-shortcuts="toolShortcuts"
            :ui="ui"
            @select="emit('setTool', $event)"
          />
        </Tip>

        <ToolbarItem v-else v-slot="{ active, actions }" :tool="item.tool.key">
          <Tip :label="toolTip(toolLabels[item.tool.key], toolShortcuts[item.tool.key])">
            <ToolButton
              :data-test-id="toolbarToolTestId(item.tool.key)"
              :icon="toolIcons[item.tool.key]"
              :label="toolLabels[item.tool.key]"
              :active="active || isToolbarToolActive(item.tool, activeTool)"
              :ui="ui"
              @click="actions.select"
            />
          </Tip>
        </ToolbarItem>
      </template>
    </ToolbarRoot>
  </div>
</template>
