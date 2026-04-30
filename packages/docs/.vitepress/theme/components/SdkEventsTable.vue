<script setup lang="ts">
import SdkDataTable from './SdkDataTable.vue'

interface Row {
  name: string
  payload?: string
  description: string
}

defineProps<{
  rows: Row[]
}>()

const columns = [
  { key: 'name', label: 'Event', kind: 'code' },
  { key: 'payload', label: 'Payload', kind: 'chip' },
  { key: 'description', label: 'Description', kind: 'description' },
] as const
</script>

<template>
  <SdkDataTable :columns="columns" :rows="rows" />
</template>
