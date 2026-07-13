<script lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import type { BindingState } from '@open-pencil/vue'

import type { BindingFieldUI } from './ui'

export interface BindingTriggerProps extends PrimitiveProps {
  label: string
  state?: BindingState
  open?: boolean
  disabled?: boolean
  derived?: boolean
  class?: HTMLAttributes['class']
  ui?: BindingFieldUI
}
</script>

<script setup lang="ts">
import { computed, normalizeClass } from 'vue'
import { Primitive } from 'reka-ui'

import { useBindingFieldUI } from '@/components/ui/binding/ui'

const {
  as = 'button',
  asChild = false,
  label,
  state = 'unbound',
  open = false,
  disabled = false,
  derived = false,
  class: className,
  ui
} = defineProps<BindingTriggerProps>()

const styles = computed(() =>
  useBindingFieldUI(
    { state, open, disabled, derived },
    { ...ui, trigger: [ui?.trigger, normalizeClass(className)].filter(Boolean).join(' ') }
  )
)

defineOptions({ inheritAttrs: false })
</script>

<template>
  <Primitive
    v-bind="$attrs"
    :as="as"
    :as-child="asChild"
    :class="styles.trigger"
    :type="!asChild && as === 'button' ? 'button' : undefined"
    :disabled="!asChild && as === 'button' ? disabled : undefined"
    :aria-label="label"
    :aria-disabled="disabled ? 'true' : undefined"
    :data-state="state"
    :data-open="open ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
    :data-derived="derived ? '' : undefined"
    data-slot="trigger"
  >
    <slot>
      <icon-lucide-diamond v-if="state === 'bound'" class="size-3" />
      <icon-lucide-diamond-plus v-else class="size-3" />
    </slot>
  </Primitive>
</template>
