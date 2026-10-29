<script setup lang="ts">
import { computed } from 'vue'

import { stickyTopLevelRow, useLayerTree } from '@open-pencil/vue/primitives/LayerTree'

import type { LayerIssueMark } from '@/app/editor/design-check/layers'

import { LAYER_TREE_ROW_HEIGHT } from './geometry'
import LayerTreeNodeRow from './LayerTreeNodeRow.vue'
import type { LayerTreeChrome, LayerTreeItemActions } from './types'

/**
 * The top-level layer pinned at the top of the panel while its children scroll beneath it, as in
 * Figma (its layers panel pins `stickyTopLevelLayersPanelChildren` one at a time). It is the
 * row itself, so clicking, expanding, hiding and locking work as on the row in the list.
 */
const { scrollTop, chrome, issueMarks } = defineProps<{
  scrollTop: number
  chrome: LayerTreeChrome
  /** Design issues by layer, so the pinned row keeps its mark as the list row does. */
  issueMarks?: ReadonlyMap<string, LayerIssueMark> | null
}>()

const emit = defineEmits<{
  /** Renaming happens on the layer's own row, which the list scrolls back to at `index`. */
  renameStart: [id: string, name: string, index: number]
}>()

const tree = useLayerTree()

const pinned = computed(() => {
  const rows = tree.visibleRows.value
  const sticky = stickyTopLevelRow(rows, scrollTop, LAYER_TREE_ROW_HEIGHT)
  if (!sticky) return null
  return { row: rows[sticky.index], index: sticky.index, offset: sticky.offset }
})

const actions = computed<LayerTreeItemActions | null>(() => {
  const id = pinned.value?.row.node.id
  if (!id) return null
  return {
    select: (additive) => tree.select(id, additive),
    toggleExpand: () => tree.toggleExpand(id),
    toggleVisibility: () => tree.toggleVisibility(id),
    toggleLock: () => tree.toggleLock(id),
    rename: (name) => tree.rename(id, name)
  }
})

function select(event: MouseEvent) {
  const id = pinned.value?.row.node.id
  if (!id) return
  tree.select(id, { additive: event.metaKey || event.ctrlKey, range: event.shiftKey })
}
</script>

<template>
  <div
    v-if="pinned && actions"
    data-test-id="layers-sticky-row"
    :data-node-id="pinned.row.node.id"
    :data-pushing-away="pinned.offset < 0 || undefined"
    class="absolute inset-x-1 top-0 z-10 border-b border-border bg-panel"
    :style="{ transform: `translateY(${pinned.offset}px)` }"
    @click="select"
  >
    <LayerTreeNodeRow
      :node="pinned.row.node"
      :level="pinned.row.level"
      :has-children="pinned.row.hasChildren"
      :selected="tree.selectedIds.value.has(pinned.row.node.id)"
      pad-left="0px"
      :expanded="true"
      :actions="actions"
      :chrome="chrome"
      :issue="issueMarks?.get(pinned.row.node.id) ?? null"
      @rename-start="(id, name) => pinned && emit('renameStart', id, name, pinned.index)"
    />
  </div>
</template>
