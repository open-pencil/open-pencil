<script setup lang="ts">
import { buttonTheme, type ButtonColor, type ButtonSize, type ButtonVariant } from '@open-pencil/ui'
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

const {
  to,
  color = 'neutral',
  variant = 'ghost',
  size = 'sm'
} = defineProps<{
  to: RouteLocationRaw
  color?: ButtonColor
  variant?: ButtonVariant
  size?: ButtonSize
}>()
const styles = computed(() => buttonTheme({ color, variant, size, shape: 'rounded' }))
</script>

<template>
  <RouterLink :to="to" :class="styles.base()"><slot /></RouterLink>
</template>
