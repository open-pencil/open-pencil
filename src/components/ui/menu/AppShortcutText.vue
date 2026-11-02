<script setup lang="ts">
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'

const { ui } = defineProps<{
  ui?: {
    base?: string
  }
}>()

const cls = computed(() => twMerge('text-[11px] text-muted', ui?.base))
</script>

<template>
  <!-- Key combinations read left to right in every language (Ctrl+, not ,+Ctrl). -->
  <span dir="ltr" :class="cls" class="[unicode-bidi:isolate]"><slot /></span>
</template>
