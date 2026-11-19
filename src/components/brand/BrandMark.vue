<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import brandMarkTheme from '@/theme/brand'

import type { BrandMarkProps } from './types'

const brandMark = tv(brandMarkTheme)

const {
  variant = 'micro',
  appearance = 'light',
  decorative = false,
  class: className
} = defineProps<BrandMarkProps>()

const sources = {
  mark: 'mark',
  micro: 'mark-micro',
  mono: 'mark-mono',
  'app-icon': 'app-icon'
} as const
const source = computed(() => {
  // The ivory tile owns its background and always uses the light palette.
  const suffix = variant !== 'app-icon' && appearance === 'dark' ? '-dark' : ''
  return `/brand/${sources[variant]}${suffix}.svg`
})
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
