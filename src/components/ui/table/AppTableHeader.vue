<script setup lang="ts">
import { useTableUI, type TableUI } from './ui'

const { ui } = defineProps<{ ui?: TableUI }>()
const cls = useTableUI(ui)
</script>

<template>
  <thead data-slot="table-header" :class="cls.header">
    <slot />
  </thead>
</template>
