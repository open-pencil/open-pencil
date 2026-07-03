<script setup lang="ts">
import { COMPONENT_TYPES, nodeIcon } from '@/app/editor/icons'
import LayerTreeActions from './LayerTreeActions.vue'
import LayerTreeDisclosure from './LayerTreeDisclosure.vue'
import LayerTreeDropIndicator from './LayerTreeDropIndicator.vue'

import type { LayerNode } from '@open-pencil/vue'
import type { LayerTreeChrome, LayerTreeItemActions } from './types'

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
</script>

<template>
  <div
    data-test-id="layers-item"
    class="group/row relative flex w-full cursor-pointer items-center gap-1 rounded border-none py-1 pr-1 text-left text-xs"
    :class="[
      selected ? 'bg-accent text-white' : 'bg-transparent text-surface hover:bg-hover',
      chrome.draggingId === node.id ? 'opacity-30' : '',
      chrome.instructionTargetId === node.id && chrome.instruction?.type === 'make-child'
        ? 'bg-accent/15 text-surface outline-2 outline-accent outline-offset-[-2px]'
        : '',
      !node.visible ? 'opacity-50' : ''
    ]"
    :style="{ paddingLeft: padLeft }"
    @dblclick="emit('renameStart', node.id, node.name)"
  >
    <LayerTreeDisclosure
      :expanded="expanded"
      :visible="hasChildren"
      @toggle="actions.toggleExpand"
    />

    <component
      :is="nodeIcon(node)"
      class="size-3 shrink-0"
      :class="COMPONENT_TYPES.has(node.type) ? 'text-component opacity-100' : 'opacity-70'"
    />
    <span class="min-w-0 flex-1 truncate">{{ node.name }}</span>

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
