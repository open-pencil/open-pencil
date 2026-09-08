<script setup lang="ts">
import { computed } from 'vue'

import {
  buttonTheme,
  type ButtonColor,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant
} from '#ui/theme/button'

const {
  color = 'neutral',
  variant = 'ghost',
  size = 'sm',
  shape = 'rounded'
} = defineProps<{
  href: string
  color?: ButtonColor
  variant?: ButtonVariant
  size?: ButtonSize
  shape?: ButtonShape
}>()

const styles = computed(() => buttonTheme({ color, variant, size, shape }))
</script>

<template>
  <a data-slot="action-link" :href="href" :class="styles.base()">
    <span v-if="$slots.leading" data-slot="leading-icon" :class="styles.icon()"><slot name="leading" /></span>
    <slot />
    <span v-if="$slots.trailing" data-slot="trailing-icon" :class="styles.icon()"><slot name="trailing" /></span>
  </a>
</template>
