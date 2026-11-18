<script setup lang="ts">
import { ToolbarRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { EditorToolDef, Tool } from '@open-pencil/core'
import {
  getToolbarToolSelection,
  isToolbarToolActive,
  toolbarOrientation,
  toolbarPopupSide,
  ToolbarItem
} from '@open-pencil/vue/primitives/Toolbar'
import type { ToolbarAlign, ToolbarSide } from '@open-pencil/vue/primitives/Toolbar'
import { toolbarToolTestId } from '@open-pencil/vue/testing'

import type { ToolbarAction, ToolbarItem as ToolbarLayoutItem } from '@/app/editor/toolbar/layout'
import { toolTip } from '@/app/editor/toolbar/shortcuts'
import ShapeToolButton from '@/components/toolbar/ShapeToolButton.vue'
import ToolButton from '@/components/toolbar/ToolButton.vue'
import ToolFlyout from '@/components/toolbar/ToolFlyout.vue'
import type { ToolbarUI, ToolIconMap, ToolLabels } from '@/components/toolbar/types'
import Tip from '@/components/ui/overlay/Tip.vue'
import toolbarTheme from '@/theme/toolbar'

const {
  items,
  activeTool,
  flyoutSelections,
  toolIcons,
  toolLabels,
  toolShortcuts,
  side = 'bottom',
  align = 'center',
  ui
} = defineProps<{
  items: ToolbarLayoutItem[]
  activeTool: Tool
  flyoutSelections: ReadonlyMap<Tool, Tool>
  toolIcons: ToolIconMap
  toolLabels: ToolLabels
  toolShortcuts: Readonly<Record<Tool, string>>
  /** The canvas edge the toolbar is docked to. */
  side?: ToolbarSide
  /** Where along its edge the toolbar sits. */
  align?: ToolbarAlign
  ui?: ToolbarUI
}>()

const styles = computed(() => tv(toolbarTheme)({ side, align }))
const popupSide = computed(() => toolbarPopupSide(side))

const emit = defineEmits<{
  setTool: [tool: Tool]
}>()

/** The tool a flyout's button shows: the active one if it is in the flyout, else the last used. */
function selectedTool(tool: EditorToolDef) {
  return getToolbarToolSelection(tool, activeTool, flyoutSelections)
}

defineSlots<{
  /** A button that runs a command, such as placing an icon, rather than picking a tool. */
  action(props: { action: ToolbarAction; side: ToolbarSide; align: ToolbarAlign }): unknown
  /** Pickers whose buttons are hidden, anchored to the toolbar's edge that faces the canvas. */
  hidden(props: { side: ToolbarSide; align: ToolbarAlign }): unknown
}>()
</script>

<template>
  <div
    data-canvas-obstacle
    :data-side="side"
    :data-align="align"
    :data-orientation="toolbarOrientation(side)"
    :class="styles.dock({ class: ui?.dock })"
  >
    <ToolbarRoot
      data-test-id="toolbar"
      :orientation="toolbarOrientation(side)"
      :class="styles.bar({ class: ui?.bar })"
    >
      <template v-for="item in items" :key="item.kind === 'tool' ? item.tool.key : item.action">
        <slot
          v-if="item.kind === 'action'"
          name="action"
          :action="item.action"
          :side="side"
          :align="align"
        />

        <ShapeToolButton
          v-else-if="item.tool.key === 'SHAPE_WITH_TEXT'"
          :side="side"
          :align="align"
          :ui="ui"
        />

        <Tip
          v-else-if="item.tool.flyout"
          :side="popupSide"
          :label="
            toolTip(toolLabels[selectedTool(item.tool)], toolShortcuts[selectedTool(item.tool)])
          "
        >
          <ToolFlyout
            :tool="item.tool"
            :active-tool="activeTool"
            :selected-tool="selectedTool(item.tool)"
            :tool-icons="toolIcons"
            :tool-labels="toolLabels"
            :tool-shortcuts="toolShortcuts"
            :side="side"
            :align="align"
            :ui="ui"
            @select="emit('setTool', $event)"
          />
        </Tip>

        <ToolbarItem v-else v-slot="{ active, actions }" :tool="item.tool.key">
          <Tip
            :side="popupSide"
            :label="toolTip(toolLabels[item.tool.key], toolShortcuts[item.tool.key])"
          >
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
    <slot name="hidden" :side="side" :align="align" />
  </div>
</template>
