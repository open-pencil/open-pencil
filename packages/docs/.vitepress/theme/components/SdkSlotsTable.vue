<script setup lang="ts">
import SdkDataTable from './SdkDataTable.vue'

interface Row {
  name: string
  props?: string
  description: string
}

defineProps<{
  rows: Row[]
}>()

const columns = [
  { key: 'name', label: 'Slot', kind: 'code' },
  { key: 'props', label: 'Props', kind: 'chip' },
  { key: 'description', label: 'Description', kind: 'description' },
] as const
</script>

<template>
  <SdkDataTable :columns="columns" :rows="rows" />
</template>
