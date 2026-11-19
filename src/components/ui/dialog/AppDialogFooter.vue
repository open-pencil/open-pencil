<script setup lang="ts">
import { useDialogUI, type DialogUI } from '@/components/ui/dialog/ui'

const { ui } = defineProps<{ ui?: DialogUI }>()
const cls = useDialogUI(ui)
</script>

<template>
  <footer data-slot="dialog-footer" :class="cls.footer">
    <div v-if="$slots.start" data-slot="dialog-footer-start" :class="cls.footerStart">
      <slot name="start" />
    </div>
    <slot />
  </footer>
</template>
