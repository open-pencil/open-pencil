<script setup lang="ts" generic="T extends string">
import { tv } from 'tailwind-variants'
import type { Component } from 'vue'

import theme from '@/theme/figjam/toolbar'

import { useCloseToolbarMenu } from './menu'

/** One choice of a toolbar menu: its value, name, and icon. */
export interface ToolbarOption<T extends string> {
  value: T
  label: string
  icon?: Component
}

/** A toolbar menu's choices as a list, the current one marked, as FigJam lists them. */
const { label, options, selected } = defineProps<{
  label: string
  options: ToolbarOption<T>[]
  selected: T | null
}>()
const emit = defineEmits<{ select: [value: T] }>()
const styles = tv(theme)()
const closeMenu = useCloseToolbarMenu()

function choose(value: T) {
  emit('select', value)
  closeMenu()
}

const ARROW_STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 }

/** Up and Down move between the choices, wrapping around, as a menu's arrow keys do. */
function moveFocus(event: KeyboardEvent) {
  const step = ARROW_STEPS[event.key]
  if (!step || !(event.currentTarget instanceof HTMLElement)) return
  event.preventDefault()
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role=menuitemradio]')]
  const current = items.indexOf(document.activeElement as HTMLElement)
  items.at((current + step) % items.length)?.focus()
}
</script>

<template>
  <div role="menu" :aria-label="label" :class="styles.options()" @keydown="moveFocus">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="menuitemradio"
      :aria-checked="option.value === selected"
      :data-state="option.value === selected ? 'on' : 'off'"
      :data-option="option.value"
      :class="styles.option()"
      @click="choose(option.value)"
    >
      <component :is="option.icon" v-if="option.icon" :class="styles.optionIcon()" />
      {{ option.label }}
    </button>
  </div>
</template>
