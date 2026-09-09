<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { LayerDragInstruction } from '@open-pencil/vue'

import layerTreeTheme from '@/theme/layer-tree'

import { useLayerTreeUI } from './ui'

const { active, instruction, level, indent } = defineProps<{
  active: boolean
  instruction: LayerDragInstruction | null
  level: number
  indent: number
}>()

const position = computed(() => {
  if (!instruction) return null
  if (instruction.type === 'make-child') return 'child' as const
  return instruction.type === 'reorder-above' ? ('above' as const) : ('below' as const)
})
const indicatorStyle = computed(() => {
  if (position.value === 'child') return { left: `${level * indent}px`, right: '4px' }
  const offset = (level - 1) * indent
  return { left: `${offset}px`, width: `calc(100% - ${offset}px)` }
})
const ui = useLayerTreeUI()
const layerTree = tv(layerTreeTheme)
const styles = computed(() => layerTree({ dropPosition: position.value ?? undefined }))
</script>

<template>
  <div
    v-if="active && position"
    data-slot="drop-indicator"
    :data-drop-position="position"
    :class="styles.dropIndicator({ class: ui?.dropIndicator })"
    :style="indicatorStyle"
  />
</template>
