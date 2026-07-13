<script setup lang="ts" generic="K extends PropertyListKey">
import { computed } from 'vue'
import { Primitive } from 'reka-ui'

import { usePropertyListPart } from '#vue/primitives/PropertyList/context'
import type {
  PropertyListItemActions,
  PropertyListItemFor,
  PropertyListItemSlotProps,
  PropertyListKey,
  PropertyListPatchFor
} from './types'

import type { Component, VNode } from 'vue'

const {
  propKey,
  index,
  dragging = false,
  disabled: disabledProp = false,
  as = 'div',
  asChild = false
} = defineProps<{
  propKey: K
  index: number
  dragging?: boolean
  disabled?: boolean
  as?: string | Component
  asChild?: boolean
}>()
const emit = defineEmits<{
  update: [index: number, item: PropertyListItemFor<K>]
  patch: [index: number, changes: PropertyListPatchFor<K>]
  remove: [index: number]
  toggleVisibility: [index: number]
}>()
defineSlots<{
  default(props: PropertyListItemSlotProps<K>): VNode[]
}>()
defineOptions({ inheritAttrs: false })

const context = usePropertyListPart(propKey)

const item = computed(() => context.items.value[index])
const hidden = computed(() => item.value?.visible === false)
const disabled = computed(() => disabledProp || context.disabled.value)
const actions: PropertyListItemActions<K> = {
  update: (nextItem) => {
    if (disabled.value) return
    emit('update', index, nextItem)
    context.actions.update(index, nextItem)
  },
  patch: (changes) => {
    if (disabled.value) return
    emit('patch', index, changes)
    context.actions.patch(index, changes)
  },
  remove: () => {
    if (disabled.value) return
    emit('remove', index)
    context.actions.remove(index)
  },
  toggleVisibility: () => {
    if (disabled.value) return
    emit('toggleVisibility', index)
    context.actions.toggleVisibility(index)
  }
}
const slotProps = computed<PropertyListItemSlotProps<K>>(() => ({
  item: item.value,
  index,
  hidden: hidden.value,
  dragging,
  disabled: disabled.value,
  actions
}))
</script>

<template>
  <Primitive
    v-bind="$attrs"
    :as="as"
    :as-child="asChild"
    :data-hidden="hidden ? '' : undefined"
    :data-dragging="dragging ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
    data-slot="item"
  >
    <slot v-bind="slotProps" />
  </Primitive>
</template>
