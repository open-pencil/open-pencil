<script lang="ts">
import type { BindingFieldUI } from '@/components/ui/binding'

export interface VariableBindingPickerProps {
  triggerLabel: string
  searchPlaceholder: string
  emptyLabel: string
  detachLabel: string
  closeLabel?: string
  createLabel?: string
  createNamePlaceholder?: string
  createSubmitLabel?: string
  createDefaultName?: string
  disabled?: boolean
  derived?: boolean
  ui?: BindingFieldUI
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import { useBindableValue } from '@open-pencil/vue'

import { VariablePicker, type VariablePickerItem } from '@/components/ui/binding'

/** The variable picker of a field inside `BindableValueRoot`, binding the field's targets. */
const {
  triggerLabel,
  searchPlaceholder,
  emptyLabel,
  detachLabel,
  closeLabel,
  createLabel,
  createNamePlaceholder,
  createSubmitLabel,
  createDefaultName,
  disabled,
  derived,
  ui
} = defineProps<VariableBindingPickerProps>()

const binding = useBindableValue<unknown>()
const open = computed({
  get: () => binding.open.value,
  set: (value: boolean) => (value ? binding.actions.openPicker() : binding.actions.closePicker())
})

function isColor(value: unknown): value is Color {
  return typeof value === 'object' && value !== null && 'r' in value
}

const items = computed<VariablePickerItem[]>(() =>
  binding.variables.value.map((variable) => {
    const value = variable.type === 'COLOR' ? binding.provider.resolve(variable.id) : undefined
    return {
      id: variable.id,
      name: variable.name,
      collection: binding.provider.collectionName?.(variable),
      color: isColor(value) ? value : undefined
    }
  })
)

defineOptions({ inheritAttrs: false })
</script>

<template>
  <VariablePicker
    v-bind="$attrs"
    :trigger-label="triggerLabel"
    :search-placeholder="searchPlaceholder"
    :empty-label="emptyLabel"
    :detach-label="detachLabel"
    :close-label="closeLabel"
    :create-label="createLabel"
    :create-name-placeholder="createNamePlaceholder"
    :create-submit-label="createSubmitLabel"
    :create-default-name="createDefaultName"
    :disabled="disabled"
    :derived="derived"
    :ui="ui"
    v-model:open="open"
    :items="items"
    :selected="binding.variable.value?.id"
    :state="binding.state.value"
    @select="binding.actions.bind($event)"
    @detach="binding.actions.unbind()"
    @create="binding.actions.create($event)"
  />
</template>
