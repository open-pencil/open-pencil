<script setup lang="ts">
import { useTableUI, type TableUI } from './ui'

/** The rows; while newer ones load these stay, faded, so the table never jumps. */
const { refreshing = false, ui } = defineProps<{ refreshing?: boolean; ui?: TableUI }>()
const cls = useTableUI(ui)
</script>

<template>
  <tbody data-slot="table-body" :class="cls.body" :data-refreshing="refreshing || undefined">
    <slot />
  </tbody>
</template>
