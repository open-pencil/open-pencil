<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { tv, type VariantProps } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import placeholderTheme from '@/theme/placeholder'

const placeholder = tv(placeholderTheme)
type PlaceholderVariants = VariantProps<typeof placeholder>
type PlaceholderUI = ComponentUI<typeof placeholderTheme>

const {
  label,
  description,
  fill = true,
  size = 'panel',
  ui
} = defineProps<{
  label: string
  description?: string
  fill?: boolean
  size?: PlaceholderVariants['size']
  ui?: PlaceholderUI
}>()

const slots = useSlots()
const styles = computed(() => {
  const theme = placeholder({ fill, size })
  return {
    root: theme.root({ class: ui?.root }),
    content: theme.content({ class: ui?.content }),
    icon: theme.icon({ class: ui?.icon }),
    label: theme.label({ class: ui?.label }),
    description: theme.description({ class: ui?.description }),
    action: theme.action({ class: ui?.action })
  }
})
</script>

<template>
  <div :class="styles.root" data-slot="placeholder">
    <div :class="styles.content" data-slot="placeholder-content">
      <div v-if="slots.icon" :class="styles.icon" data-slot="placeholder-icon" aria-hidden="true">
        <slot name="icon" />
      </div>
      <p :class="styles.label" data-slot="placeholder-label">{{ label }}</p>
      <p v-if="description" :class="styles.description" data-slot="placeholder-description">
        {{ description }}
      </p>
      <div v-if="slots.action" :class="styles.action" data-slot="placeholder-action">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>
