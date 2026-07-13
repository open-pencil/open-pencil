<script setup lang="ts">
import { Primitive } from 'reka-ui'

import { usePropertySection } from '#vue/primitives/PropertySection/context'
import type { PropertySectionPartProps } from '#vue/primitives/PropertySection/types'

const { as = 'button', asChild = false } = defineProps<PropertySectionPartProps>()
const emit = defineEmits<{ activate: [] }>()
const ctx = usePropertySection()
defineOptions({ inheritAttrs: false })

function activate() {
  if (ctx.disabled.value) return
  ctx.actions.open()
  emit('activate')
}
</script>

<template>
  <Primitive
    v-if="ctx.empty.value"
    v-bind="{ ...$attrs, ...ctx.stateAttrs.value }"
    :as="as"
    :as-child="asChild"
    :type="!asChild && as === 'button' ? 'button' : undefined"
    data-slot="empty-action"
    @click="activate"
  >
    <slot v-bind="ctx.slotProps.value" />
  </Primitive>
</template>
