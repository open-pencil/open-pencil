<script setup lang="ts">
import { computed } from 'vue'
import { tv, type VariantProps } from 'tailwind-variants'

import theme from '@/theme/input-group'
import type { ComponentUI } from '@/components/ui/types'

const inputGroup = tv(theme)
type InputGroupVariants = VariantProps<typeof inputGroup>

type InputGroupUI = ComponentUI<typeof theme>

const {
  size = 'sm',
  disabled = false,
  ui
} = defineProps<{
  size?: NonNullable<InputGroupVariants['size']>
  disabled?: boolean
  ui?: InputGroupUI
}>()

const cls = computed(() => inputGroup({ size, disabled }))
</script>

<template>
  <div
    data-slot="input-group"
    :data-size="size"
    :data-disabled="disabled || undefined"
    :class="cls.root({ class: ui?.root })"
  >
    <div v-if="$slots.attachment" data-slot="input-group-attachment" :class="ui?.attachment">
      <slot name="attachment" />
    </div>
    <div data-slot="input-group-control" :class="cls.control({ class: ui?.control })">
      <slot />
    </div>
    <div data-slot="input-group-toolbar" :class="cls.toolbar({ class: ui?.toolbar })">
      <slot name="leading" />
      <div data-slot="input-group-model" :class="cls.model({ class: ui?.model })">
        <slot name="model" />
      </div>
      <div data-slot="input-group-actions" :class="cls.actions({ class: ui?.actions })">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
