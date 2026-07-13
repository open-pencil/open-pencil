<script setup lang="ts">
import { CollapsibleTrigger } from 'reka-ui'

import { usePropertySection } from '#vue/primitives/PropertySection/context'
import type { PropertySectionPartProps } from '#vue/primitives/PropertySection/types'

const { as = 'button', asChild = false } = defineProps<PropertySectionPartProps>()
const ctx = usePropertySection()
defineOptions({ inheritAttrs: false })
</script>

<template>
  <CollapsibleTrigger
    v-bind="{ ...$attrs, ...ctx.stateAttrs.value }"
    :as="as"
    :as-child="asChild"
    data-slot="title"
  >
    <slot v-bind="ctx.slotProps.value" />
  </CollapsibleTrigger>
</template>
