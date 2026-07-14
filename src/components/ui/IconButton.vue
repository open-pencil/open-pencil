<script setup lang="ts">
import { computed, normalizeClass, useAttrs } from 'vue'
import { tv } from 'tailwind-variants'

import theme from '@/theme/icon-button'
import Tip from '@/components/ui/Tip.vue'

const {
  active = false,
  disabled = false,
  label,
  side = 'top',
  size = 'sm',
  type = 'button'
} = defineProps<{
  active?: boolean
  disabled?: boolean
  label?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit' | 'reset'
}>()

const attrs = useAttrs()

defineOptions({ inheritAttrs: false })

const buttonAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const cls = computed(() =>
  tv(theme)({ size, active, disabled, class: normalizeClass(attrs.class) })
)
</script>

<template>
  <Tip :label="label" :side="side" :disabled="disabled || !label">
    <button
      v-bind="buttonAttrs"
      data-slot="icon-button"
      :type="type"
      :disabled="disabled"
      :aria-label="label"
      :aria-pressed="active ? 'true' : undefined"
      :data-state="active ? 'on' : 'off'"
      :class="cls"
    >
      <slot />
    </button>
  </Tip>
</template>
