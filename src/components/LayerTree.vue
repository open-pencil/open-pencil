<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { TreeRoot, TreeItem, ContextMenuRoot, ContextMenuTrigger, ContextMenuPortal } from 'reka-ui'

import { useInlineRename } from '@/composables/use-inline-rename'

import IconCircle from '~icons/lucide/circle'
import IconComponent from '~icons/lucide/diamond'
import IconComponentSet from '~icons/lucide/component'
import IconColumns from '~icons/lucide/columns-3'
import IconFrame from '~icons/lucide/frame'
import IconGrid from '~icons/lucide/grid-3x3'
import IconGroup from '~icons/lucide/group'

import IconMinus from '~icons/lucide/minus'
import IconPenTool from '~icons/lucide/pen-tool'
import IconRows from '~icons/lucide/rows-3'
import IconSection from '~icons/lucide/layout-grid'
import IconSquare from '~icons/lucide/square'
import IconType from '~icons/lucide/type'

import { useEditorStore } from '@/stores/editor'
import NodeContextMenuContent from './NodeContextMenuContent.vue'

const store = useEditorStore()
const rename = useInlineRename((id, name) => store.renameNode(id, name))

interface LayerNode {
  id: string
  name: string
  type: string
  layoutMode: string
  visible: boolean
  locked: boolean
  children?: LayerNode[]
}

const nodeIcons: Partial<Record<string, typeof IconSquare>> = {
  SECTION: IconSection,
  ELLIPSE: IconCircle,
  FRAME: IconFrame,
  GROUP: IconGroup,
  COMPONENT: IconComponent,
  COMPONENT_SET: IconComponentSet,
  INSTANCE: IconComponent,
  LINE: IconMinus,
  TEXT: IconType,
  VECTOR: IconPenTool,
  RECTANGLE: IconSquare
}

const autoLayoutIcons: Partial<Record<string, typeof IconSquare>> = {
  VERTICAL: IconRows,
  HORIZONTAL: IconColumns,
  GRID: IconGrid
}

function nodeIcon(node: LayerNode) {
  if (node.type === 'FRAME' && node.layoutMode !== 'NONE') {
    return autoLayoutIcons[node.layoutMode] ?? IconFrame
  }
  return nodeIcons[node.type] ?? IconSquare
}

const COMPONENT_TYPES = new Set(['COMPONENT', 'COMPONENT_SET', 'INSTANCE'])

function toggleNodeVisibility(id: string) {
  const node = store.graph.getNode(id)
  if (node)
    store.updateNodeWithUndo(
      id,
      { visible: !node.visible },
      node.visible ? 'Hide layer' : 'Show layer'
    )
}

function toggleNodeLock(id: string) {
  const node = store.graph.getNode(id)
  if (node)
    store.updateNodeWithUndo(
      id,
      { locked: !node.locked },
      node.locked ? 'Unlock layer' : 'Lock layer'
    )
}

function buildTree(parentId: string): LayerNode[] {
  const parent = store.graph.getNode(parentId)
  if (!parent) return []
  return parent.childIds
    .map((cid) => store.graph.getNode(cid))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      layoutMode: node.layoutMode,
      visible: node.visible,
      locked: node.locked,
      children: node.childIds.length > 0 ? buildTree(node.id) : undefined
    }))
}

const items = ref(buildTree(store.state.currentPageId))
const treeKey = ref(0)

watch([() => store.state.sceneVersion, () => store.state.currentPageId], () => {
  items.value = buildTree(store.state.currentPageId)
  treeKey.value++
})

const expanded = ref<string[]>([])

watch(
  () => store.state.selectedIds,
  (ids) => {
    const toExpand = new Set(expanded.value)
    for (const id of ids) {
      let node = store.graph.getNode(id)
      while (node?.parentId && node.parentId !== store.state.currentPageId) {
        toExpand.add(node.parentId)
        node = store.graph.getNode(node.parentId)
      }
    }
    if (toExpand.size > expanded.value.length) {
      expanded.value = [...toExpand]
    }
    nextTick(() => {
      const first = [...ids][0]
      if (!first) return
      const el = listRef.value?.querySelector<HTMLElement>(`[data-node-id="${first}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
  }
)

function syncCanvasScope(nodeId: string) {
  const node = store.graph.getNode(nodeId)
  if (!node) return
  let parentId = node.parentId
  while (parentId && parentId !== store.state.currentPageId) {
    if (store.graph.isContainer(parentId)) {
      store.enterContainer(parentId)
      return
    }
    const parent = store.graph.getNode(parentId)
    parentId = parent?.parentId
  }
  store.state.enteredContainerId = null
}

function onSelect(ev: CustomEvent) {
  ev.preventDefault()
  const node = ev.detail.value as LayerNode
  if (ev.detail.originalEvent?.shiftKey) {
    store.select([node.id], true)
  } else {
    store.select([node.id])
    syncCanvasScope(node.id)
  }
}

function onLayerRightClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]')
  if (!row) return
  const nodeId = row.dataset.nodeId
  if (!nodeId) return
  if (!store.state.selectedIds.has(nodeId)) {
    store.select([nodeId])
  }
}

function toggleExpand(id: string) {
  const idx = expanded.value.indexOf(id)
  if (idx !== -1) {
    expanded.value = expanded.value.filter((e) => e !== id)
  } else {
    expanded.value = [...expanded.value, id]
  }
}

const listRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const dragNodeId = ref<string | null>(null)
const indicatorY = ref(-1)
const indicatorDepth = ref(0)
const dropTarget = ref<{ parentId: string; index: number } | null>(null)
const dropIntoId = ref<string | null>(null)

let stopMove: (() => void) | undefined
let stopUp: (() => void) | undefined
let dragStartY = 0
let didMove = false

onUnmounted(() => {
  stopMove?.()
  stopUp?.()
})

function onPointerDown(e: PointerEvent, nodeId: string) {
  dragStartY = e.clientY
  didMove = false
  dragNodeId.value = nodeId

  stopMove = useEventListener(document, 'pointermove', (ev: PointerEvent) => {
    if (!didMove && Math.abs(ev.clientY - dragStartY) < 4) return
    didMove = true
    dragging.value = true
    updateDropTarget(ev)
  })

  stopUp = useEventListener(document, 'pointerup', () => {
    if (didMove && dropTarget.value && dragNodeId.value) {
      const { parentId, index } = dropTarget.value
      if (parentId !== dragNodeId.value && !store.graph.isDescendant(parentId, dragNodeId.value)) {
        store.reorderChildWithUndo(dragNodeId.value, parentId, index)
      }
    } else if (!didMove && dragNodeId.value) {
      store.select([dragNodeId.value])
    }
    cleanup()
  })
}

function cleanup() {
  dragging.value = false
  dragNodeId.value = null
  indicatorY.value = -1
  dropTarget.value = null
  dropIntoId.value = null
  stopMove?.()
  stopUp?.()
}

interface InsertPosition {
  parentId: string
  index: number
  y: number
  depth: number
}

function resolveInsertPosition(
  row: HTMLElement,
  rowId: string,
  rect: DOMRect,
  listRect: DOMRect,
  scrollTop: number,
  edge: 'before' | 'after'
): InsertPosition | null {
  const rowNode = store.graph.getNode(rowId)
  if (!rowNode) return null
  const parentId = rowNode.parentId ?? store.state.currentPageId
  const parent = store.graph.getNode(parentId)
  if (!parent) return null

  const idx = parent.childIds.indexOf(rowId)
  const level = parseInt(row.dataset.level ?? '0', 10)

  if (edge === 'before') {
    return {
      parentId,
      index: Math.max(0, idx),
      y: rect.top - listRect.top + scrollTop,
      depth: level
    }
  }
  return {
    parentId,
    index: idx + 1,
    y: rect.bottom - listRect.top + scrollTop,
    depth: level
  }
}

type DropZone = 'top' | 'mid-container' | 'bottom'

function classifyDropZone(mouseY: number, rect: DOMRect, isContainer: boolean): DropZone {
  const topZone = rect.top + rect.height * 0.25
  const bottomZone = rect.top + rect.height * 0.75

  if (mouseY > topZone && mouseY < bottomZone && isContainer) return 'mid-container'
  if (mouseY <= rect.top + rect.height / 2) return 'top'
  return 'bottom'
}

function updateDropTarget(ev: PointerEvent) {
  const list = listRef.value
  if (!list || !dragNodeId.value) return

  const rows = list.querySelectorAll<HTMLElement>('[data-node-id]')
  const listRect = list.getBoundingClientRect()
  const mouseY = ev.clientY

  let bestInsertBefore: InsertPosition | null = null
  let bestInto: { nodeId: string } | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowId = row.dataset.nodeId
    if (!rowId || rowId === dragNodeId.value) continue

    const rowNode = store.graph.getNode(rowId)
    if (!rowNode) continue

    const rect = row.getBoundingClientRect()
    const zone = classifyDropZone(mouseY, rect, store.graph.isContainer(rowId))

    if (zone === 'mid-container') {
      bestInto = { nodeId: rowId }
      bestInsertBefore = null
      break
    }

    if (zone === 'top') {
      bestInsertBefore = resolveInsertPosition(row, rowId, rect, listRect, list.scrollTop, 'before')
      break
    }

    if (i === rows.length - 1) {
      bestInsertBefore = resolveInsertPosition(row, rowId, rect, listRect, list.scrollTop, 'after')
    }
  }

  if (bestInto) {
    dropIntoId.value = bestInto.nodeId
    indicatorY.value = -1
    const container = store.graph.getNode(bestInto.nodeId)
    dropTarget.value = container
      ? { parentId: bestInto.nodeId, index: container.childIds.length }
      : null
  } else if (bestInsertBefore) {
    dropIntoId.value = null
    indicatorY.value = bestInsertBefore.y
    indicatorDepth.value = bestInsertBefore.depth
    dropTarget.value = { parentId: bestInsertBefore.parentId, index: bestInsertBefore.index }
  } else {
    dropIntoId.value = null
    indicatorY.value = -1
    dropTarget.value = null
  }
}
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu="onLayerRightClick">
      <div ref="listRef" class="relative scrollbar-thin flex-1 overflow-y-auto px-1">
        <TreeRoot
          :key="treeKey"
          v-slot="{ flattenItems }"
          :items="items"
          :get-key="(v: LayerNode) => v.id"
          :get-children="(v: LayerNode) => v.children"
          v-model:expanded="expanded"
        >
          <div
            v-for="item in flattenItems"
            :key="item._id"
            :data-node-id="item.value.id"
            :data-level="item.level"
          >
            <TreeItem
              v-slot="{ isExpanded }"
              v-bind="item.bind"
              as-child
              @select="onSelect"
              @toggle="
                (e: CustomEvent) => {
                  if (e.detail.originalEvent?.type === 'click') e.preventDefault()
                }
              "
            >
              <div
                v-if="rename.editingId.value === item.value.id"
                class="flex w-full items-center gap-1 py-1"
                :style="{ paddingLeft: `${8 + (item.level - 1) * 16}px` }"
              >
                <span
                  v-if="item.hasChildren"
                  class="flex w-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-transform hover:text-surface"
                  :class="isExpanded ? 'rotate-90' : 'rotate-0'"
                  @click.stop="toggleExpand(item.value.id)"
                >
                  <icon-lucide-chevron-right class="size-3" />
                </span>
                <span v-else class="w-4 shrink-0" />
                <component :is="nodeIcon(item.value)" class="size-3 shrink-0 opacity-70" />
                <input
                  :ref="
                    (el) => {
                      if (el) rename.focusInput(el as HTMLInputElement)
                    }
                  "
                  data-layer-edit
                  data-test-id="layers-item-input"
                  class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0 text-xs text-surface outline-none"
                  :value="item.value.name"
                  @blur="rename.commit(item.value.id, $event.target as HTMLInputElement)"
                  @keydown="rename.onKeydown"
                />
              </div>
              <button
                v-else
                data-test-id="layers-item"
                class="group/row flex w-full cursor-pointer items-center gap-1 rounded border-none py-1 pr-1 text-left text-xs"
                :class="[
                  store.state.selectedIds.has(item.value.id)
                    ? 'bg-accent text-white'
                    : 'bg-transparent text-surface hover:bg-hover',
                  dragging && dragNodeId === item.value.id ? 'opacity-30' : '',
                  dropIntoId === item.value.id ? 'ring-2 ring-accent ring-inset' : '',
                  !item.value.visible ? 'opacity-50' : ''
                ]"
                :style="{ paddingLeft: `${8 + (item.level - 1) * 16}px` }"
                @pointerdown.prevent="onPointerDown($event, item.value.id)"
                @dblclick="rename.start(item.value.id, item.value.name, '[data-layer-edit]')"
              >
                <span
                  v-if="item.hasChildren"
                  class="flex w-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-transform hover:text-surface"
                  :class="isExpanded ? 'rotate-90' : 'rotate-0'"
                  @click.stop="toggleExpand(item.value.id)"
                >
                  <icon-lucide-chevron-right class="size-3" />
                </span>
                <span v-else class="w-4 shrink-0" />
                <component
                  :is="nodeIcon(item.value)"
                  class="size-3 shrink-0"
                  :class="
                    COMPONENT_TYPES.has(item.value.type)
                      ? 'text-component opacity-100'
                      : 'opacity-70'
                  "
                />
                <span class="min-w-0 flex-1 truncate">{{ item.value.name }}</span>
                <span
                  class="flex shrink-0 items-center gap-0.5"
                  :class="
                    !item.value.locked && item.value.visible
                      ? 'opacity-0 group-hover/row:opacity-100'
                      : ''
                  "
                >
                  <span
                    class="flex size-4 items-center justify-center rounded hover:bg-white/15"
                    :title="item.value.locked ? 'Unlock' : 'Lock'"
                    @pointerdown.stop
                    @click.stop="toggleNodeLock(item.value.id)"
                  >
                    <icon-lucide-lock
                      v-if="item.value.locked"
                      class="size-3"
                      :class="
                        store.state.selectedIds.has(item.value.id) ? 'text-white' : 'text-surface'
                      "
                    />
                    <icon-lucide-unlock
                      v-else
                      class="size-3 opacity-0 group-hover/row:opacity-100"
                      :class="
                        store.state.selectedIds.has(item.value.id)
                          ? 'text-white/80'
                          : 'text-surface/70'
                      "
                    />
                  </span>
                  <span
                    class="flex size-4 items-center justify-center rounded hover:bg-white/15"
                    :title="item.value.visible ? 'Hide' : 'Show'"
                    @pointerdown.stop
                    @click.stop="toggleNodeVisibility(item.value.id)"
                  >
                    <icon-lucide-eye-off
                      v-if="!item.value.visible"
                      class="size-3"
                      :class="
                        store.state.selectedIds.has(item.value.id) ? 'text-white' : 'text-surface'
                      "
                    />
                    <icon-lucide-eye
                      v-else
                      class="size-3 opacity-0 group-hover/row:opacity-100"
                      :class="
                        store.state.selectedIds.has(item.value.id)
                          ? 'text-white/80'
                          : 'text-surface/70'
                      "
                    />
                  </span>
                </span>
              </button>
            </TreeItem>
          </div>
        </TreeRoot>

        <div
          v-if="dragging && indicatorY >= 0"
          class="pointer-events-none absolute right-1 left-1 h-0.5 bg-accent"
          :style="{ top: `${indicatorY}px`, marginLeft: `${indicatorDepth * 16}px` }"
        />
      </div>
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <NodeContextMenuContent />
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
