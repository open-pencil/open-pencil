<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { LayerNode } from '@open-pencil/vue'

import { COMPONENT_TYPES, nodeIcon } from '@/app/editor/icons'
import layerTreeTheme from '@/theme/layer-tree'

import LayerTreeActions from './LayerTreeActions.vue'
import LayerTreeDisclosure from './LayerTreeDisclosure.vue'
import LayerTreeDropIndicator from './LayerTreeDropIndicator.vue'
import type { LayerTreeChrome, LayerTreeItemActions } from './types'
import { useLayerTreeUI } from './ui'

const { node, level, hasChildren, selected, padLeft, expanded, actions, chrome } = defineProps<{
  node: LayerNode
  level: number
  hasChildren: boolean
  selected: boolean
  padLeft: string
  expanded: boolean
  actions: LayerTreeItemActions
  chrome: LayerTreeChrome
}>()

const emit = defineEmits<{
  renameStart: [id: string, name: string]
}>()

const ui = useLayerTreeUI()
const layerTree = tv(layerTreeTheme)
const styles = computed(() =>
  layerTree({
    selected,
    focused: chrome.focused,
    dragging: chrome.draggingId === node.id,
    visible: node.visible,
    component: COMPONENT_TYPES.has(node.type),
    childDropTarget:
      chrome.instructionTargetId === node.id && chrome.instruction?.type === 'make-child'
  })
)
</script>

<template>
  <div
    data-test-id="layers-item"
    data-slot="row"
    :data-selected="selected || undefined"
    :data-focused="chrome.focused || undefined"
    :data-dragging="chrome.draggingId === node.id || undefined"
    :data-hidden="!node.visible || undefined"
    :data-drop-position="
      chrome.instructionTargetId === node.id && chrome.instruction?.type === 'make-child'
        ? 'child'
        : undefined
    "
    :class="styles.row({ class: ui?.row })"
    :style="{ paddingLeft: padLeft }"
    @dblclick="emit('renameStart', node.id, node.name)"
  >
    <LayerTreeDisclosure
      :expanded="expanded"
      :visible="hasChildren"
      @toggle="actions.toggleExpand"
    />

    <component :is="nodeIcon(node)" data-slot="icon" :class="styles.icon({ class: ui?.icon })" />
    <span data-slot="label" :class="styles.label({ class: ui?.label })">{{ node.name }}</span>

    <LayerTreeActions
      :node="node"
      :selected="selected"
      @toggle-lock="actions.toggleLock"
      @toggle-visibility="actions.toggleVisibility"
    />

    <LayerTreeDropIndicator
      :active="chrome.instructionTargetId === node.id"
      :instruction="chrome.instruction"
      :level="level"
      :indent="chrome.indent"
    />
  </div>
</template>
