<script setup lang="ts">
import { useAttrs, watch } from 'vue'
import { tv } from 'tailwind-variants'
import {
  TreeItem,
  TreeVirtualizer,
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuPortal
} from 'reka-ui'

import { LayerTreeRoot, LayerTreeItem, useInlineRename } from '@open-pencil/vue'
import type {
  LayerDragInstruction,
  LayerNode,
  LayerSelectionMode,
  LayerTreeVirtualizer
} from '@open-pencil/vue'
import { useEditorStore } from '@/app/editor/active-store'
import CanvasMenu from '../canvas/CanvasMenu.vue'
import LayerTreeNodeRow from './LayerTreeNodeRow.vue'
import LayerTreeRenameRow from './LayerTreeRenameRow.vue'
import { provideLayerTreeUI } from './ui'

import layerTreeTheme from '@/theme/layer-tree'

import type { LayerTreeUI } from './ui'

interface LayerTreeRootActions {
  select: (id: string, selection: boolean | LayerSelectionMode) => void
  toggleExpand: (id: string) => void
  setFocused: (focused: boolean) => void
  setVirtualizer: (virtualizer: LayerTreeVirtualizer) => void
}

interface LayerTreeSlotScope {
  actions: LayerTreeRootActions
  draggingId: string | null
  instruction: LayerDragInstruction | null
  instructionTargetId: string | null
  focused: boolean
}

defineOptions({ inheritAttrs: false })

const { ui } = defineProps<{ ui?: LayerTreeUI }>()

const INDENT = 16
const attrs = useAttrs()
const styles = tv(layerTreeTheme)()
provideLayerTreeUI(() => ui)
const store = useEditorStore()
const rename = useInlineRename((id, name) => store.renameNode(id, name))
const renameControls = {
  commit: rename.commit,
  onKeydown: rename.onKeydown,
  focusInput: rename.focusInput
}

watch(
  () => store.state.renameNodeId,
  (id) => {
    if (!id) return
    const node = store.graph.getNode(id)
    store.state.renameNodeId = null
    if (node) rename.start(node.id, node.name)
  },
  { immediate: true }
)

function onLayerRightClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]')
  if (!row?.dataset.nodeId) return
  if (!store.state.selectedIds.has(row.dataset.nodeId)) store.select([row.dataset.nodeId])
}

function layerSelectionMode(e: CustomEvent): LayerSelectionMode {
  const mouseEvent = e.detail?.originalEvent as MouseEvent | undefined
  return {
    additive: !!(mouseEvent?.metaKey || mouseEvent?.ctrlKey),
    range: !!mouseEvent?.shiftKey
  }
}

function onTreeSelect(
  e: CustomEvent,
  id: string,
  select: (id: string, selection: boolean | LayerSelectionMode) => void
) {
  e.preventDefault()
  select(id, layerSelectionMode(e))
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
    focused: scope.focused,
    indent: INDENT
  }
}

function registerVirtualizer(
  actions: LayerTreeRootActions,
  virtualizer: LayerTreeVirtualizer
): boolean {
  actions.setVirtualizer(virtualizer)
  return true
}

function onFocusOut(event: FocusEvent, actions: LayerTreeRootActions) {
  const next = event.relatedTarget
  if (
    next instanceof Node &&
    event.currentTarget instanceof Node &&
    event.currentTarget.contains(next)
  ) {
    return
  }
  actions.setFocused(false)
}
</script>

<template>
  <LayerTreeRoot v-slot="scope" :indent-per-level="INDENT">
    <ContextMenuRoot :modal="false">
      <div
        v-bind="attrs"
        class="relative min-h-0 flex-1 overflow-hidden"
        @focusin="scope.actions.setFocused(true)"
        @focusout="onFocusOut($event, scope.actions)"
      >
        <ContextMenuTrigger as-child @contextmenu="onLayerRightClick">
          <div
            data-test-id="layers-scroll"
            data-slot="viewport"
            :class="styles.viewport({ class: ui?.viewport })"
          >
            <TreeVirtualizer
              v-slot="{ item, virtualizer }"
              :estimate-size="24"
              :text-content="layerTextContent"
            >
              <template v-if="registerVirtualizer(scope.actions, virtualizer)">
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
                    v-slot="{
                      node,
                      isSelected,
                      padLeft,
                      actions,
                      instruction,
                      instructionTargetId
                    }"
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
                      :chrome="
                        chrome({
                          ...scope,
                          instruction,
                          instructionTargetId
                        })
                      "
                      @rename-start="rename.start"
                    />
                  </LayerTreeItem>
                </TreeItem>
              </template>
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
