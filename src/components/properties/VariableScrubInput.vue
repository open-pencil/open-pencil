<script setup lang="ts">
import ScrubInput from '@/components/ScrubInput.vue'
import BoundVariableButton from '@/components/properties/BoundVariableButton.vue'
import VariablePickerPopover from '@/components/properties/VariablePickerPopover.vue'
import { useI18n, useNumberVariableBinding } from '@open-pencil/vue'

import type { NumberBindingPath } from '@open-pencil/vue'

const {
  modelValue,
  min,
  max,
  step,
  icon,
  label,
  suffix,
  sensitivity,
  placeholder,
  nodeId,
  bindingPath
} = defineProps<{
  modelValue: number | symbol
  min?: number
  max?: number
  step?: number
  icon?: string
  label?: string
  suffix?: string
  sensitivity?: number
  placeholder?: string
  nodeId: string
  bindingPath: NumberBindingPath
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  commit: [value: number, previous: number]
}>()

const { panels, dialogs } = useI18n()
const binding = useNumberVariableBinding(bindingPath)

function resolvedValue(): number | symbol {
  const variable = binding.getBoundVariable(nodeId)
  if (!variable) return modelValue
  const resolved = binding.store.resolveNumberVariable(variable.id)
  return resolved ?? modelValue
}

function onUpdate(value: number) {
  if (binding.getBoundVariable(nodeId)) binding.unbindVariable(nodeId)
  emit('update:modelValue', value)
}

function onBind(variableId: string) {
  binding.bindVariable(nodeId, variableId)
  const resolved = binding.store.resolveNumberVariable(variableId)
  if (resolved != null) emit('update:modelValue', resolved)
}

function onCreate(name: string) {
  const value = typeof modelValue === 'number' ? modelValue : 0
  binding.createAndBindVariable(nodeId, value, name)
}

defineOptions({ inheritAttrs: true })
</script>

<template>
  <ScrubInput
    v-bind="$attrs"
    :icon="icon"
    :label="label"
    :suffix="suffix"
    :sensitivity="sensitivity"
    :placeholder="placeholder"
    :model-value="resolvedValue()"
    :min="min"
    :max="max"
    :step="step"
    @update:model-value="onUpdate"
    @commit="(v: number, p: number) => emit('commit', v, p)"
  >
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <template #suffix>
      <BoundVariableButton
        v-if="binding.getBoundVariable(nodeId)"
        :label="panels.detachVariable"
        @detach="binding.unbindVariable(nodeId)"
      />
      <VariablePickerPopover
        v-else
        v-model:search-term="binding.searchTerm.value"
        :variables="binding.filteredVariables.value"
        :trigger-label="panels.applyVariable"
        :search-placeholder="dialogs.search"
        :empty-label="panels.noVariablesFound"
        :create-label="
          panels.createNumberVariable({
            value: typeof modelValue === 'number' ? Math.round(modelValue) : 0
          })
        "
        :create-name-placeholder="panels.variableName"
        :create-submit-label="panels.create"
        @select="onBind($event.id)"
        @create="onCreate"
      />
      <slot name="after-variable" />
    </template>
  </ScrubInput>
</template>
