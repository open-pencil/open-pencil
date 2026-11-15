<script setup lang="ts">
import { useTableUI, type TableUI } from './ui'

/** One row across every column, for what shows when there are no rows. */
const { colspan, ui } = defineProps<{ colspan: number; ui?: TableUI }>()
const cls = useTableUI(ui)
</script>

<template>
  <tr data-slot="table-empty">
    <td :colspan="colspan" :class="cls.empty"><slot /></td>
  </tr>
</template>
