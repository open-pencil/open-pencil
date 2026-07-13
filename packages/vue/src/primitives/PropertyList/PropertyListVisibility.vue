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
const emit = defineEmits<{ toggle: [index: number] }>()
const context = usePropertyListPart(propKey)
const disabled = computed(() => disabledProp || context.disabled.value)
const visible = computed(() => context.items.value[index]?.visible !== false)
defineOptions({ inheritAttrs: false })

function toggle() {
  if (disabled.value) return
  emit('toggle', index)
  context.actions.toggleVisibility(index)
}
</script>

<template>
  <Primitive
    v-bind="$attrs"
    :as="as"
    :as-child="asChild"
    :type="!asChild && as === 'button' ? 'button' : undefined"
    :disabled="disabled"
    :aria-pressed="visible"
    :data-hidden="visible ? undefined : ''"
    data-slot="visibility"
    @click="toggle"
  >
    <slot :visible="visible" />
  </Primitive>
</template>
