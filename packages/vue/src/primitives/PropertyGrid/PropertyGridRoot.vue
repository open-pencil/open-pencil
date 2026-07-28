<script setup lang="ts">
import type {
  PropertyGridRootProps,
  PropertyGridRootSlots
} from '#vue/primitives/PropertyGrid/types'

const { columns = 1, distribution = 'equal' } = defineProps<PropertyGridRootProps>()
defineSlots<PropertyGridRootSlots>()
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div
    v-bind="$attrs"
    data-slot="root"
    data-property-grid
    :data-columns="columns"
    :data-distribution="distribution"
  >
    <div data-slot="fields">
      <slot />
    </div>
    <div v-if="$slots.actions" data-slot="actions">
      <slot name="actions" />
    </div>
  </div>
</template>
