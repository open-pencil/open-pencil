<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, normalizeClass, ref, type HTMLAttributes } from 'vue'

import type { LayoutAlign, LayoutCounterAlign } from '@open-pencil/scene-graph'

import layoutAlignmentTheme from '@/theme/layout-alignment'

const {
  cells,
  label,
  class: className,
  ui
} = defineProps<{
  cells: readonly {
    primary: LayoutAlign
    counter: LayoutCounterAlign
    label: string
    active: boolean
  }[]
  label: string
  class?: HTMLAttributes['class']
  ui?: { grid?: string; cell?: string; dot?: string }
}>()
const emit = defineEmits<{ select: [primary: LayoutAlign, counter: LayoutCounterAlign] }>()
const theme = tv(layoutAlignmentTheme)
const styles = theme()
const focusedIndex = ref<number | null>(null)
const tabIndex = computed(
  () =>
    focusedIndex.value ??
    Math.max(
      0,
      cells.findIndex((cell) => cell.active)
    )
)

function navigate(event: KeyboardEvent, index: number) {
  const row = Math.floor(index / 3)
  const column = index % 3
  let next = index
  switch (event.code) {
    case 'ArrowLeft':
      next = row * 3 + Math.max(0, column - 1)
      break
    case 'ArrowRight':
      next = row * 3 + Math.min(2, column + 1)
      break
    case 'ArrowUp':
      next = Math.max(0, row - 1) * 3 + column
      break
    case 'ArrowDown':
      next = Math.min(2, row + 1) * 3 + column
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = cells.length - 1
      break
    default:
      return
  }
  event.preventDefault()
  event.stopPropagation()
  if (!(event.currentTarget instanceof HTMLElement)) return
  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')
  buttons?.item(next)?.focus()
}
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    data-slot="alignment"
    :class="styles.grid({ class: [ui?.grid, normalizeClass(className)] })"
  >
    <button
      v-for="(cell, index) in cells"
      :key="`${cell.primary}-${cell.counter}`"
      type="button"
      data-slot="cell"
      :aria-label="cell.label"
      :aria-pressed="cell.active"
      :data-active="cell.active || undefined"
      :tabindex="tabIndex === index ? 0 : -1"
      :class="theme({ active: cell.active }).cell({ class: ui?.cell })"
      @focus="focusedIndex = index"
      @keydown="navigate($event, index)"
      @click="emit('select', cell.primary, cell.counter)"
    >
      <span :class="styles.dot({ class: ui?.dot })" />
    </button>
  </div>
</template>
