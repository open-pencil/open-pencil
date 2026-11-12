<script setup lang="ts">
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'

const { ui } = defineProps<{
  ui?: {
    base?: string
  }
}>()

const cls = computed(() => twMerge('text-2xs text-muted', ui?.base))
</script>

<template>
  <span dir="ltr" :class="cls"><slot /></span>
</template>
