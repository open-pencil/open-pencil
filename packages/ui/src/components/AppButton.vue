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
  shape = 'rounded',
  disabled = false,
  loading = false,
  type = 'button'
} = defineProps<{
  color?: ButtonColor
  variant?: ButtonVariant
  size?: ButtonSize
  shape?: ButtonShape
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
}>()

const styles = computed(() => buttonTheme({ color, variant, size, shape }))
const isDisabled = computed(() => disabled || loading)
</script>

<template>
  <button
    data-slot="button"
    :type="type"
    :disabled="isDisabled"
    :aria-disabled="isDisabled ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :class="styles.base()"
  >
    <span v-if="loading" data-slot="loading-icon" :class="styles.icon()">
      <slot name="loading"><span class="block size-full animate-spin rounded-full border-2 border-current border-r-transparent" /></slot>
    </span>
    <span v-else-if="$slots.leading" data-slot="leading-icon" :class="styles.icon()">
      <slot name="leading" />
    </span>
    <slot />
    <span v-if="$slots.trailing" data-slot="trailing-icon" :class="styles.icon()">
      <slot name="trailing" />
    </span>
  </button>
</template>
