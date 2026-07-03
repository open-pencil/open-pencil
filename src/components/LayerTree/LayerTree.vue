<script setup lang="ts">
import { useAttrs } from 'vue'
import {
  TreeItem,
  TreeVirtualizer,
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuPortal
} from 'reka-ui'

import { LayerTreeRoot, LayerTreeItem, useInlineRename } from '@open-pencil/vue'
import type { LayerDragInstruction, LayerNode } from '@open-pencil/vue'
import { useEditorStore } from '@/app/editor/active-store'
import CanvasMenu from '../canvas/CanvasMenu.vue'
import LayerTreeNodeRow from './LayerTreeNodeRow.vue'
import LayerTreeRenameRow from './LayerTreeRenameRow.vue'

interface LayerTreeRootActions {
  select: (id: string, additive: boolean) => void
  toggleExpand: (id: string) => void
}

interface LayerTreeSlotScope {
  actions: LayerTreeRootActions
  draggingId: string | null
  instruction: LayerDragInstruction | null
  instructionTargetId: string | null
}

defineOptions({ inheritAttrs: false })

const INDENT = 16
const attrs = useAttrs()
const store = useEditorStore()
const rename = useInlineRename((id, name) => store.renameNode(id, name))
const renameControls = {
  commit: rename.commit,
  onKeydown: rename.onKeydown,
  focusInput: rename.focusInput
}

function onLayerRightClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]')
  if (!row?.dataset.nodeId) return
  if (!store.state.selectedIds.has(row.dataset.nodeId)) store.select([row.dataset.nodeId])
}

function isAdditiveSelect(e: CustomEvent): boolean {
  const mouseEvent = e.detail?.originalEvent as MouseEvent | undefined
  return !!(mouseEvent?.shiftKey || mouseEvent?.metaKey || mouseEvent?.ctrlKey)
}

function onTreeSelect(e: CustomEvent, id: string, select: (id: string, additive: boolean) => void) {
  e.preventDefault()
  select(id, isAdditiveSelect(e))
}

function isLayerNode(value: unknown): value is LayerNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'type' in value &&
    'layoutMode' in value &&
    'visible' in value &&
    'locked' in value &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    typeof value.layoutMode === 'string' &&
    typeof value.visible === 'boolean' &&
    typeof value.locked === 'boolean'
  )
}

function toLayerNode(value: unknown): LayerNode {
  if (isLayerNode(value)) return value
  throw new Error('[open-pencil] Invalid layer tree item')
}

function layerTextContent(value: unknown): string {
  return toLayerNode(value).name
}

function chrome(scope: Omit<LayerTreeSlotScope, 'actions'>) {
  return {
    draggingId: scope.draggingId,
    instruction: scope.instruction,
    instructionTargetId: scope.instructionTargetId,
    indent: INDENT
  }
}
</script>

<template>
  <LayerTreeRoot v-slot="scope" :indent-per-level="INDENT">
    <ContextMenuRoot :modal="false">
      <div v-bind="attrs" class="relative min-h-0 flex-1 overflow-hidden">
        <ContextMenuTrigger as-child @contextmenu="onLayerRightClick">
          <div data-test-id="layers-scroll" class="scrollbar-thin h-full overflow-y-auto px-1">
            <TreeVirtualizer v-slot="{ item }" :estimate-size="24" :text-content="layerTextContent">
              <TreeItem
                v-slot="{ isExpanded }"
                v-bind="item.bind"
                as-child
                @select="
                  (e: CustomEvent) =>
                    onTreeSelect(e, toLayerNode(item.value).id, scope.actions.select)
                "
                @toggle="
                  (e: CustomEvent) => {
                    if (e.detail.originalEvent?.type === 'click') e.preventDefault()
                  }
                "
              >
                <LayerTreeItem
                  v-slot="{ node, isSelected, padLeft, actions }"
                  :node="toLayerNode(item.value)"
                  :level="item.level"
                  :has-children="item.hasChildren"
                >
                  <LayerTreeRenameRow
                    v-if="rename.editingId.value === node.id"
                    :node="node"
                    :has-children="item.hasChildren"
                    :pad-left="padLeft"
                    :expanded="isExpanded"
                    :actions="actions"
                    :rename-controls="renameControls"
                  />

                  <LayerTreeNodeRow
                    v-else
                    :node="node"
                    :level="item.level"
                    :has-children="item.hasChildren"
                    :selected="isSelected"
                    :pad-left="padLeft"
                    :expanded="isExpanded"
                    :actions="actions"
                    :chrome="chrome(scope)"
                    @rename-start="rename.start"
                  />
                </LayerTreeItem>
              </TreeItem>
            </TreeVirtualizer>
          </div>
        </ContextMenuTrigger>
      </div>
      <ContextMenuPortal>
        <CanvasMenu />
      </ContextMenuPortal>
    </ContextMenuRoot>
  </LayerTreeRoot>
</template>
