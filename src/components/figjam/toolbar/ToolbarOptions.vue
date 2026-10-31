<script setup lang="ts" generic="T extends string">
import { tv } from 'tailwind-variants'
import type { Component } from 'vue'

import theme from '@/theme/figjam/toolbar'

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
</script>

<template>
  <div role="menu" :aria-label="label" :class="styles.options()">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="menuitemradio"
      :aria-checked="option.value === selected"
      :data-state="option.value === selected ? 'on' : 'off'"
      :data-option="option.value"
      :class="styles.option()"
      @click="emit('select', option.value)"
    >
      <component :is="option.icon" v-if="option.icon" :class="styles.optionIcon()" />
      {{ option.label }}
    </button>
  </div>
</template>
