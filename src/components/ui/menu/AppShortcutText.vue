<script setup lang="ts">
import { computed } from 'vue'
import { twMerge } from 'tailwind-merge'

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
