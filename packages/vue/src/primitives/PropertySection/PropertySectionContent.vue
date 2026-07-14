<script setup lang="ts">
import { CollapsibleContent } from 'reka-ui'

import { usePropertySection } from '#vue/primitives/PropertySection/context'
import type { PropertySectionPartProps } from '#vue/primitives/PropertySection/types'

const { as = 'div', asChild = false } = defineProps<PropertySectionPartProps>()
const ctx = usePropertySection()
defineOptions({ inheritAttrs: false })
</script>

<template>
  <CollapsibleContent
    v-bind="{ ...$attrs, ...ctx.stateAttrs.value }"
    :as="as"
    :as-child="asChild"
    data-slot="content"
  >
    <slot v-bind="ctx.slotProps.value" />
  </CollapsibleContent>
</template>
