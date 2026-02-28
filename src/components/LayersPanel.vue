<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import { TreeRoot, TreeItem } from 'reka-ui'

import IconCircle from '~icons/lucide/circle'
import IconFrame from '~icons/lucide/frame'
import IconGroup from '~icons/lucide/group'
import IconMinus from '~icons/lucide/minus'
import IconPenTool from '~icons/lucide/pen-tool'
import IconSquare from '~icons/lucide/square'
import IconType from '~icons/lucide/type'

import { useEditorStore } from '../stores/editor'

const store = useEditorStore()

interface LayerNode {
  id: string
  name: string
  type: string
  children?: LayerNode[]
}

const nodeIcons: Record<string, typeof IconSquare> = {
  ELLIPSE: IconCircle,
  FRAME: IconFrame,
  GROUP: IconGroup,
  LINE: IconMinus,
  TEXT: IconType,
  VECTOR: IconPenTool,
  RECTANGLE: IconSquare
}

function buildTree(parentId: string): LayerNode[] {
  const parent = store.graph.getNode(parentId)
  if (!parent) return []
  const result: LayerNode[] = []
  for (const cid of parent.childIds) {
    const node = store.graph.getNode(cid)
    if (!node) continue
    result.push({
      id: node.id,
      name: node.name,
      type: node.type,
      children: node.childIds.length > 0 ? buildTree(node.id) : undefined,
    })
  }
  return result
}

const items = computed(() => {
  void store.state.renderVersion
  return buildTree(store.graph.rootId)
})

const expanded = ref<string[]>([])

function onSelect(ev: CustomEvent) {
  ev.preventDefault()
  const node = ev.detail.value as LayerNode
  if (ev.detail.originalEvent?.shiftKey) {
    store.select([node.id], true)
  } else {
    store.select([node.id])
  }
}

function toggleExpand(id: string) {
  const idx = expanded.value.indexOf(id)
  if (idx >= 0) {
    expanded.value = expanded.value.filter(e => e !== id)
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
        store.graph.reorderChild(dragNodeId.value, parentId, index)
        store.requestRender()
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

function updateDropTarget(ev: PointerEvent) {
  const list = listRef.value
  if (!list || !dragNodeId.value) return

  const rows = list.querySelectorAll<HTMLElement>('[data-node-id]')
  const listRect = list.getBoundingClientRect()
  const mouseY = ev.clientY

  let bestInsertBefore: { parentId: string; index: number; y: number; depth: number } | null = null
  let bestInto: { nodeId: string } | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowId = row.dataset.nodeId!
    if (rowId === dragNodeId.value) continue

    const rect = row.getBoundingClientRect()
    const rowMid = rect.top + rect.height / 2
    const topZone = rect.top + rect.height * 0.25
    const bottomZone = rect.top + rect.height * 0.75

    const rowNode = store.graph.getNode(rowId)
    if (!rowNode) continue

    if (mouseY > topZone && mouseY < bottomZone && store.graph.isContainer(rowId)) {
      bestInto = { nodeId: rowId }
      bestInsertBefore = null
      break
    }

    if (mouseY <= rowMid) {
      const parentId = rowNode.parentId ?? store.graph.rootId
      const parent = store.graph.getNode(parentId)
      if (parent) {
        const idx = parent.childIds.indexOf(rowId)
        const level = parseInt(row.dataset.level ?? '0')
        bestInsertBefore = { parentId, index: Math.max(0, idx), y: rect.top - listRect.top + list.scrollTop, depth: level }
      }
      break
    }

    if (i === rows.length - 1 && mouseY > rowMid) {
      const parentId = rowNode.parentId ?? store.graph.rootId
      const parent = store.graph.getNode(parentId)
      if (parent) {
        const idx = parent.childIds.indexOf(rowId)
        const level = parseInt(row.dataset.level ?? '0')
        bestInsertBefore = { parentId, index: idx + 1, y: rect.bottom - listRect.top + list.scrollTop, depth: level }
      }
    }
  }

  if (bestInto) {
    dropIntoId.value = bestInto.nodeId
    indicatorY.value = -1
    const container = store.graph.getNode(bestInto.nodeId)
    dropTarget.value = container ? { parentId: bestInto.nodeId, index: container.childIds.length } : null
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
  <aside class="flex w-60 flex-col overflow-y-auto border-r border-border bg-panel">
    <header class="shrink-0 px-3 py-2 text-[11px] uppercase tracking-wider text-muted">Layers</header>
    <div ref="listRef" class="relative flex-1 overflow-y-auto px-1">
      <TreeRoot
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
          >
            <button
              class="group/row flex w-full cursor-pointer items-center gap-1 rounded border-none py-1 text-left text-xs"
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
            >
              <span
                v-if="item.hasChildren"
                class="flex w-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-transform hover:text-surface"
                :class="isExpanded ? 'rotate-90' : 'rotate-0'"
                @click.stop="toggleExpand(item.value.id)"
              >
                <icon-lucide-chevron-right class="size-3 rotate-90" />
              </span>
              <span v-else class="w-4 shrink-0" />
              <component :is="nodeIcons[item.value.type] ?? IconSquare" class="size-3 shrink-0 opacity-70" />
              <span class="min-w-0 flex-1 truncate">{{ item.value.name }}</span>
              <icon-lucide-eye-off
                v-if="!item.value.visible"
                class="mr-1 size-3 shrink-0 text-muted"
              />
            </button>
          </TreeItem>
        </div>
      </TreeRoot>

      <!-- Drop indicator line -->
      <div
        v-if="dragging && indicatorY >= 0"
        class="pointer-events-none absolute right-1 left-1 h-0.5 bg-accent"
        :style="{ top: `${indicatorY}px`, marginLeft: `${indicatorDepth * 16}px` }"
      />
    </div>
  </aside>
</template>
