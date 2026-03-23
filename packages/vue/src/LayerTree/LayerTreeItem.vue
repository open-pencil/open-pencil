<script setup lang="ts">
import { computed, ref } from 'vue'

import { useLayerTree } from './context'

import type { LayerNode } from './context'

const { node, level, hasChildren } = defineProps<{
  node: LayerNode
  level: number
  hasChildren: boolean
}>()

const emit = defineEmits<{
  select: [id: string, additive: boolean]
  toggleExpand: [id: string]
  toggleVisibility: [id: string]
  toggleLock: [id: string]
  rename: [id: string, name: string]
}>()

const ctx = useLayerTree()

const isSelected = computed(() => ctx.selectedIds.value.has(node.id))
const isDragging = computed(() => false)
const padLeft = computed(() => `${8 + (level - 1) * ctx.indentPerLevel}px`)

const rowEl = ref<HTMLElement | null>(null)

function onRef(el: unknown) {
  const htmlEl = el as HTMLElement | null
  rowEl.value = htmlEl
  ctx.setRowRef(node.id, htmlEl)
}

defineExpose({ rowEl })
</script>

<template>
  <div :ref="onRef" :data-node-id="node.id">
    <slot
      :node="node"
      :level="level"
      :has-children="hasChildren"
      :is-selected="isSelected"
      :is-dragging="isDragging"
      :pad-left="padLeft"
      :select="
        (additive: boolean) => {
          emit('select', node.id, additive)
          ctx.select(node.id, additive)
        }
      "
      :toggle-expand="
        () => {
          emit('toggleExpand', node.id)
          ctx.toggleExpand(node.id)
        }
      "
      :toggle-visibility="
        () => {
          emit('toggleVisibility', node.id)
          ctx.toggleVisibility(node.id)
        }
      "
      :toggle-lock="
        () => {
          emit('toggleLock', node.id)
          ctx.toggleLock(node.id)
        }
      "
      :rename="
        (name: string) => {
          emit('rename', node.id, name)
          ctx.rename(node.id, name)
        }
      "
    />
  </div>
</template>
