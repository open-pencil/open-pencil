<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

const { side = 'top' } = defineProps<{
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}>()
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="4"
        class="z-50 animate-in rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg zoom-in-95 fade-in"
      >
        {{ label }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
