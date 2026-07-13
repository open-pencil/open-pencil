<script setup lang="ts">
import { computed } from 'vue'
import { Primitive } from 'reka-ui'

import { useBindableValue } from '#vue/primitives/BindableValue/context'
import type { BindableValueTriggerProps } from '#vue/primitives/BindableValue/types'

const { as = 'button', asChild = false } = defineProps<BindableValueTriggerProps>()
const ctx = useBindableValue()
const semanticAttrs = computed(() => ({
  type: !asChild && as === 'button' ? ('button' as const) : undefined,
  'aria-expanded': ctx.open.value,
  'aria-haspopup': 'listbox' as const
}))

defineOptions({ inheritAttrs: false })
</script>

<template>
  <Primitive
    v-bind="{ ...$attrs, ...ctx.stateAttrs.value, ...semanticAttrs }"
    :as="as"
    :as-child="asChild"
    data-slot="trigger"
    @click="ctx.actions.togglePicker"
  >
    <slot v-bind="ctx.slotProps.value" />
  </Primitive>
</template>
