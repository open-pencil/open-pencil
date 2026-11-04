<script setup lang="ts">
import { normalizeClass, type HTMLAttributes } from 'vue'

import { table } from './ui'

const { class: className, ui } = defineProps<{
  class?: HTMLAttributes['class']
  ui?: { cell?: string }
}>()
const cls = table()
</script>

<template>
  <td data-slot="table-cell" :class="cls.cell({ class: [ui?.cell, normalizeClass(className)] })">
    <slot />
  </td>
</template>
