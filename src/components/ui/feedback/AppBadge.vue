<script setup lang="ts">
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'

const { ui } = defineProps<{
  ui?: {
    base?: string
  }
}>()

const cls = computed(() =>
  twMerge('shrink-0 rounded bg-accent/10 px-1 py-px text-[9px] text-accent', ui?.base)
)
</script>

<template>
  <span :class="cls"><slot /></span>
</template>
