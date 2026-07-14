<script setup lang="ts" generic="K extends PropertyListKey">
import { computed } from 'vue'
import { Primitive } from 'reka-ui'

import { usePropertyListPart } from '#vue/primitives/PropertyList/context'
import type { PropertyListKey, PropertyListPartProps } from './types'

const {
  propKey,
  index,
  as = 'button',
  asChild = false,
  disabled: disabledProp = false
} = defineProps<PropertyListPartProps<K> & { index: number }>()
const emit = defineEmits<{ remove: [index: number] }>()
const context = usePropertyListPart(propKey)
const disabled = computed(() => disabledProp || context.disabled.value)
defineOptions({ inheritAttrs: false })

function remove() {
  if (disabled.value) return
  emit('remove', index)
  context.actions.remove(index)
}
</script>

<template>
  <Primitive
    v-bind="$attrs"
    :as="as"
    :as-child="asChild"
    :type="!asChild && as === 'button' ? 'button' : undefined"
    :disabled="disabled"
    data-slot="remove"
    @click="remove"
  >
    <slot />
  </Primitive>
</template>
