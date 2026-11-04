<script setup lang="ts" generic="T extends string">
import { tv } from 'tailwind-variants'

import { useCloseToolbarMenu } from '@/components/figjam/toolbar/menu'
import theme from '@/theme/figjam/swatches'

/** A swatch for one colour of a palette, as sticky notes and shapes pick theirs. */
export interface Swatch<T extends string> {
  value: T
  hex: string
  label: string
}

/**
 * A palette as a row of round swatches, eleven to a line as in FigJam's colour menus, and,
 * when `none` is given, a last swatch for no colour at all.
 */
const {
  label,
  swatches,
  selected,
  none,
  keepsMenuOpen = false
} = defineProps<{
  label: string
  swatches: Swatch<T>[]
  selected: T | null
  none?: { label: string; active: boolean }
  /** Whether a pick leaves the toolbar menu open, as a line menu's palette does in FigJam. */
  keepsMenuOpen?: boolean
}>()
const emit = defineEmits<{ select: [value: T]; none: [] }>()
const styles = tv(theme)
const closeMenu = useCloseToolbarMenu()

function pick(value: T) {
  emit('select', value)
  if (!keepsMenuOpen) closeMenu()
}

function pickNone() {
  emit('none')
  if (!keepsMenuOpen) closeMenu()
}
</script>

<template>
  <div :class="styles().root()" role="radiogroup" :aria-label="label">
    <button
      v-for="swatch in swatches"
      :key="swatch.value"
      type="button"
      role="radio"
      :aria-checked="!none?.active && swatch.value === selected"
      :aria-label="swatch.label"
      :data-swatch="swatch.value"
      :class="styles({ active: !none?.active && swatch.value === selected }).swatch()"
      :style="{ backgroundColor: swatch.hex }"
      @click="pick(swatch.value)"
    />
    <button
      v-if="none"
      type="button"
      role="radio"
      :aria-checked="none.active"
      :aria-label="none.label"
      data-swatch="none"
      :class="styles({ active: none.active }).swatch({ class: styles().none() })"
      @click="pickNone"
    >
      <icon-lucide-ban class="size-3.5" />
    </button>
  </div>
</template>
