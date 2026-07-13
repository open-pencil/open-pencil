<script setup lang="ts" generic="K extends PropertyListKey">
import {
  PropertyListRoot as HeadlessPropertyListRoot,
  useEditorPropertyList
} from '@open-pencil/vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { PropertyListKey, PropertyListRootSlotProps } from '@open-pencil/vue'
import type { VNode } from 'vue'

const { propKey, label } = defineProps<{
  propKey: K
  label?: string
}>()
defineSlots<{
  default?(
    props: PropertyListRootSlotProps<K> & {
      isMulti: boolean
      activeNode: SceneNode | null
    }
  ): VNode[]
}>()

const context = useEditorPropertyList(propKey)
</script>

<template>
  <HeadlessPropertyListRoot
    v-if="context.active.value"
    v-slot="slotProps"
    :prop-key="propKey"
    :label="label"
    :items="context.items.value"
    :mixed="context.isMixed.value"
    @add="context.actions.add"
    @remove="context.actions.remove"
    @update="context.actions.update"
    @patch="context.actions.patch"
    @toggle-visibility="context.actions.toggleVisibility"
    @reorder="context.actions.reorder"
  >
    <slot
      v-bind="slotProps"
      :is-multi="context.isMulti.value"
      :active-node="context.activeNode.value"
    />
  </HeadlessPropertyListRoot>
</template>
