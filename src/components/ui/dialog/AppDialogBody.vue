<script setup lang="ts">
import { useDialogUI, type DialogUI } from '@/components/ui/dialog/ui'

const { ui } = defineProps<{ ui?: DialogUI }>()
const cls = useDialogUI(ui)
</script>

<template>
  <div data-slot="dialog-body" :class="cls.body">
    <slot />
  </div>
</template>
