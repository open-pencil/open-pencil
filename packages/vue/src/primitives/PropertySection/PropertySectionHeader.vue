<script setup lang="ts">
import { Primitive } from 'reka-ui'

import { usePropertySection } from '#vue/primitives/PropertySection/context'
import type { PropertySectionPartProps } from '#vue/primitives/PropertySection/types'

const { as = 'div', asChild = false } = defineProps<PropertySectionPartProps>()
const ctx = usePropertySection()
defineOptions({ inheritAttrs: false })
</script>

<template>
  <Primitive
    v-bind="{ ...$attrs, ...ctx.stateAttrs.value }"
    :as="as"
    :as-child="asChild"
    data-slot="header"
  >
    <slot v-bind="ctx.slotProps.value" />
  </Primitive>
</template>
