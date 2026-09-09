<script setup lang="ts">
import { TreeItem, TreeRoot, TreeVirtualizer } from 'reka-ui'
import { reactive, ref } from 'vue'

import { useInlineRename } from '@open-pencil/vue'
import type { LayerNode } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'

import { LAYER_TREE_ROW_HEIGHT } from '../geometry'
import LayerTreeNodeRow from '../LayerTreeNodeRow.vue'
import LayerTreeRenameRow from '../LayerTreeRenameRow.vue'
import { provideLayerTreeUI } from '../ui'

interface DemoNode extends LayerNode {
  children?: DemoNode[]
}
const items = reactive<DemoNode[]>(
  Array.from({ length: 100 }, (_, index) => ({
    id: `node-${index}`,
    name: `Layer ${index + 1}`,
    type: 'FRAME',
    layoutMode: 'NONE',
    visible: true,
    locked: false,
    children: [
      {
        id: `child-${index}`,
        name: `Child ${index + 1}`,
        type: 'RECTANGLE',
        layoutMode: 'NONE',
        visible: true,
        locked: false
      }
    ]
  }))
)
function resolveNode(id: unknown): DemoNode {
  const node = items
    .flatMap((item) => [item, ...(item.children ?? [])])
    .find((item) => item.id === id)
  if (!node) throw new Error('Unknown demo node')
  return node
}

const selected = ref<DemoNode[]>(items.slice(0, 1))
const focused = ref(true)
const rename = useInlineRename((id, name) => {
  resolveNode(id).name = name
})
const renameControls = {
  commit: rename.commit,
  onKeydown: rename.onKeydown,
  focusInput: rename.focusInput
}
function focusOut(event: FocusEvent) {
  if (
    event.currentTarget instanceof Node &&
    event.relatedTarget instanceof Node &&
    event.currentTarget.contains(event.relatedTarget)
  )
    return
  focused.value = false
}
provideLayerTreeUI(() => undefined)
</script>

<template>
  <TreeRoot
    v-model="selected"
    :items="items"
    :get-key="(item) => item.id"
    multiple
    class="h-80 w-72 overflow-y-auto bg-panel"
    aria-label="Layers"
    @focusin="focused = true"
    @focusout="focusOut"
  >
    <TreeVirtualizer
      v-slot="{ item }"
      :estimate-size="LAYER_TREE_ROW_HEIGHT"
      :text-content="(node) => node.name"
    >
      <TreeItem
        as-child
        v-bind="item.bind"
        v-slot="{ isSelected, isExpanded, handleToggle }"
        @toggle="
          (event) => {
            if (event.detail.originalEvent.type === 'click') event.preventDefault()
          }
        "
      >
        <LayerTreeRenameRow
          v-if="rename.editingId.value === item.value.id"
          :node="resolveNode(item.value.id)"
          :has-children="item.hasChildren"
          :pad-left="`${(item.level - 1) * 16}px`"
          :expanded="isExpanded"
          :actions="{
            select: () => {},
            toggleExpand: handleToggle,
            toggleLock: () => {},
            toggleVisibility: () => {},
            rename: () => {}
          }"
          :rename-controls="renameControls"
        />
        <LayerTreeNodeRow
          v-else
          @rename-start="rename.start"
          :node="resolveNode(item.value.id)"
          :level="item.level"
          :has-children="item.hasChildren"
          :selected="isSelected"
          :expanded="isExpanded"
          :pad-left="`${(item.level - 1) * 16}px`"
          :chrome="{
            focused,
            draggingId: null,
            instruction: null,
            instructionTargetId: null,
            indent: 16
          }"
          :actions="{
            select: () => {},
            toggleExpand: handleToggle,
            toggleLock: () => {
              item.value.locked = !item.value.locked
            },
            toggleVisibility: () => {
              item.value.visible = !item.value.visible
            },
            rename: () => {}
          }"
        />
      </TreeItem>
    </TreeVirtualizer>
  </TreeRoot>
  <AppButton class="mt-3">Outside tree</AppButton>
</template>
