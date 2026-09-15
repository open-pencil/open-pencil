<script setup lang="ts">
import { computed } from 'vue'

import { brandMark } from '@/theme/brand'

import type { BrandMarkProps } from './types'

const {
  variant = 'micro',
  appearance = 'light',
  decorative = false,
  class: className
} = defineProps<BrandMarkProps>()

const sources = { mark: 'mark', micro: 'mark-micro', mono: 'mark-mono' } as const
const source = computed(
  () => `/brand/${sources[variant]}${appearance === 'dark' ? '-dark' : ''}.svg`
)
</script>

<template>
  <img
    :src="source"
    :class="brandMark({ class: className })"
    :alt="decorative ? '' : 'OpenPencil'"
    width="16"
    height="16"
  />
</template>
