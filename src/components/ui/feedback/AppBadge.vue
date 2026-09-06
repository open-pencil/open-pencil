<script setup lang="ts">
import { computed } from 'vue'
import { twMerge } from 'tailwind-merge'

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
