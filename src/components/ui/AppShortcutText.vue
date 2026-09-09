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
  <span :class="cls"><slot /></span>
</template>
