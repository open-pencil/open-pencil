<script setup lang="ts">
import { normalizeClass, type HTMLAttributes } from 'vue'

import { table } from './ui'

/** A column's header; `labelHidden` keeps it for assistive technology only, as for row actions. */
const {
  colspan,
  labelHidden = false,
  class: className,
  ui
} = defineProps<{
  colspan?: number
  labelHidden?: boolean
  class?: HTMLAttributes['class']
  ui?: { head?: string }
}>()
const cls = table()
</script>

<template>
  <th
    data-slot="table-head"
    scope="col"
    :colspan="colspan"
    :class="cls.head({ class: [ui?.head, normalizeClass(className)] })"
  >
    <span :class="{ 'sr-only': labelHidden }"><slot /></span>
  </th>
</template>
