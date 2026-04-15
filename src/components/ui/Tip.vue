<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

import { useTooltipUI } from '@/components/ui/tooltip'

const cls = useTooltipUI({ content: 'animate-in zoom-in-95 fade-in' })

const { side = 'top', disabled = false } = defineProps<{
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
}>()
</script>

<template>
  <TooltipRoot :open="disabled ? false : undefined">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent :side="side" :side-offset="4" :class="cls.content">
        {{ label }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
