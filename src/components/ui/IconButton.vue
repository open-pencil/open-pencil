<script setup lang="ts">
import { computed, normalizeClass, useAttrs } from 'vue'

import { useIconButtonUI } from '@/components/ui/icon-button'
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

const cls = computed(
  () =>
    useIconButtonUI({
      size,
      ui: {
        base: normalizeClass([
          attrs.class,
          active ? 'border-accent text-accent' : '',
          disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted' : ''
        ])
      }
    }).base
)
</script>

<template>
  <Tip :label="label" :side="side" :disabled="disabled || !label">
    <button
      v-bind="buttonAttrs"
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
