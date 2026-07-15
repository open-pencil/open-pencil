<script setup lang="ts" generic="K extends PropertyListKey">
import { computed } from 'vue'
import { Primitive } from 'reka-ui'

import { usePropertyListPart } from '#vue/primitives/PropertyList/context'
import type { PropertyListItemFor, PropertyListKey, PropertyListPartProps } from './types'

const {
  propKey,
  item,
  as = 'button',
  asChild = false,
  disabled: disabledProp = false
} = defineProps<PropertyListPartProps<K> & { item: PropertyListItemFor<K> }>()
const emit = defineEmits<{ add: [item: PropertyListItemFor<K>] }>()
const context = usePropertyListPart(propKey)
const disabled = computed(() => disabledProp || context.disabled.value)
defineOptions({ inheritAttrs: false })

function add() {
  if (disabled.value) return
  emit('add', item)
  context.actions.add(item)
}
</script>

<template>
  <Primitive
    v-bind="$attrs"
    :as="as"
    :as-child="asChild"
    :type="!asChild && as === 'button' ? 'button' : undefined"
    :disabled="disabled"
    data-slot="add"
    @click="add"
  >
    <slot />
  </Primitive>
</template>
