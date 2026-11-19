<script setup lang="ts">
import { useTableUI, type TableUI } from './ui'

const { ui } = defineProps<{ ui?: TableUI }>()
const cls = useTableUI(ui)
</script>

<template>
  <tr data-slot="table-row" :class="cls.row">
    <slot />
  </tr>
</template>
