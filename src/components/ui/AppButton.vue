<script setup lang="ts">
import { computed, useAttrs } from 'vue'

import {
  useAppButtonUI,
  type AppButtonColor,
  type AppButtonShape,
  type AppButtonSize,
  type AppButtonVariant
} from '@/theme/button'

const {
  color = 'neutral',
  variant = 'ghost',
  size = 'sm',
  shape = 'rounded',
  disabled = false,
  loading = false,
  type = 'button',
  ui
} = defineProps<{
  color?: AppButtonColor
  variant?: AppButtonVariant
  size?: AppButtonSize
  shape?: AppButtonShape
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  ui?: { base?: string; icon?: string }
}>()

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const styles = computed(() => useAppButtonUI({ color, variant, size, shape, ui }))
const isDisabled = computed(() => disabled || loading)
</script>

<template>
  <button
    v-bind="attrs"
    data-slot="button"
    :type="type"
    :disabled="isDisabled"
    :aria-disabled="isDisabled ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :class="styles.base"
  >
    <span v-if="loading" data-slot="loading-icon" :class="styles.icon">
      <icon-lucide-loader-2 class="animate-spin" />
    </span>
    <span v-else-if="$slots.leading" data-slot="leading-icon" :class="styles.icon">
      <slot name="leading" />
    </span>
    <slot />
    <span v-if="$slots.trailing" data-slot="trailing-icon" :class="styles.icon">
      <slot name="trailing" />
    </span>
  </button>
</template>
