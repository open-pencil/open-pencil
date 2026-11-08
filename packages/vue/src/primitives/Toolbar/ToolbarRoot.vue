<script setup lang="ts">
import { computed, getCurrentInstance, reactive, ref, watch } from 'vue'

import { EDITOR_TOOLS, type EditorToolDef, type Tool } from '@open-pencil/core'

import { useEditor } from '#vue/editor/context'
import {
  provideToolbar,
  toolbarOrientation,
  toolbarPopupSide,
  type ToolbarAlign,
  type ToolbarSide
} from '#vue/primitives/Toolbar/context'

const {
  tools = EDITOR_TOOLS,
  side: sideProp,
  defaultSide = 'bottom',
  align: alignProp,
  defaultAlign = 'center'
} = defineProps<{
  tools?: EditorToolDef[]
  /** The canvas edge the toolbar is docked to; bind with `v-model:side` to control it. */
  side?: ToolbarSide
  /** The dock while `side` is not controlled. @default 'bottom' */
  defaultSide?: ToolbarSide
  /** Where along its edge the toolbar sits; bind with `v-model:align` to control it. */
  align?: ToolbarAlign
  /** The alignment while `align` is not controlled. @default 'center' */
  defaultAlign?: ToolbarAlign
}>()

const emit = defineEmits<{
  /** A descendant asked to dock the toolbar elsewhere, such as from a context menu. */
  'update:side': [side: ToolbarSide]
  /** A descendant asked to move the toolbar along its edge. */
  'update:align': [align: ToolbarAlign]
}>()

const editor = useEditor()
const activeTool = computed(() => editor.state.activeTool)
const expandedFlyout = ref<Tool | null>(null)
const flyoutSelections = reactive(new Map<Tool, Tool>())

const vnodeProps = getCurrentInstance()?.vnode.props
const controlled = (name: string) => (vnodeProps ? Object.hasOwn(vnodeProps, name) : false)
const sideControlled = controlled('side')
const alignControlled = controlled('align')
const uncontrolledSide = ref(defaultSide)
const uncontrolledAlign = ref(defaultAlign)
const side = computed(() => (sideControlled ? (sideProp ?? defaultSide) : uncontrolledSide.value))
const align = computed(() =>
  alignControlled ? (alignProp ?? defaultAlign) : uncontrolledAlign.value
)
const orientation = computed(() => toolbarOrientation(side.value))
const popupSide = computed(() => toolbarPopupSide(side.value))

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

function setSide(next: ToolbarSide) {
  if (!sideControlled) uncontrolledSide.value = next
  emit('update:side', next)
}

function setAlign(next: ToolbarAlign) {
  if (!alignControlled) uncontrolledAlign.value = next
  emit('update:align', next)
}

function toggleFlyout(tool: Tool) {
  expandedFlyout.value = expandedFlyout.value === tool ? null : tool
}

function closeFlyout() {
  expandedFlyout.value = null
}

const actions = {
  setTool,
  setSide,
  setAlign,
  toggleFlyout,
  closeFlyout
}

provideToolbar({
  editor,
  tools,
  activeTool,
  flyoutSelections,
  expandedFlyout,
  side,
  orientation,
  align,
  popupSide,
  setTool,
  setSide,
  setAlign,
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
    :side="side"
    :orientation="orientation"
    :align="align"
    :popup-side="popupSide"
    :actions="actions"
  />
</template>
