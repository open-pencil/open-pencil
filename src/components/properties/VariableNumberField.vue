<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { BindableValueRoot, useI18n, useNumberBindingProvider } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import { BindingPill, useBindingFieldUI } from '@/components/ui/binding'

import type { BindingTarget, NumberBindingPath } from '@open-pencil/vue'

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
const provider = useNumberBindingProvider()
const attrs = useAttrs()
const targets = computed<BindingTarget[]>(() => [{ nodeId, path: bindingPath }])
const accessibleLabel = computed(() => {
  const ariaLabel = attrs['aria-label']
  return typeof ariaLabel === 'string' ? ariaLabel : (label ?? bindingPath)
})
const bindingStyles = useBindingFieldUI()

function bindingTooltip(name: string, resolvedValue: unknown) {
  if (typeof resolvedValue !== 'number') return name
  return `${name} · ${resolvedValue}${suffix ?? ''}`
}

defineOptions({ inheritAttrs: false })
</script>

<template>
  <BindableValueRoot
    v-slot="binding"
    :provider="provider"
    :targets="targets"
    :value="typeof modelValue === 'number' ? modelValue : 0"
  >
    <NumberField
      v-bind="$attrs"
      :icon="icon"
      :label="label"
      :suffix="suffix"
      :sensitivity="sensitivity"
      :placeholder="placeholder"
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :ui="{ root: bindingStyles.root }"
      :data-property="bindingPath"
      :aria-label="accessibleLabel"
      @update:model-value="emit('update:modelValue', $event)"
      @commit="(value: number, previous: number) => emit('commit', value, previous)"
    >
      <template v-if="$slots.icon" #icon>
        <slot name="icon" />
      </template>
      <template v-if="binding.variable" #bound>
        <BindingPill
          :label="binding.variable.name"
          :tooltip="bindingTooltip(binding.variable.name, binding.resolvedValue)"
        />
      </template>
      <template #suffix>
        <span :class="$slots['after-variable'] ? '' : 'pr-1'" class="flex items-center">
          <VariableBindingPicker
            :trigger-label="panels.applyVariable"
            :search-placeholder="dialogs.search"
            :empty-label="panels.noVariablesFound"
            :detach-label="panels.detachVariable"
            :create-label="
              panels.createNumberVariable({
                value: typeof modelValue === 'number' ? Math.round(modelValue) : 0
              })
            "
            :create-name-placeholder="panels.variableName"
            :create-submit-label="panels.create"
          />
        </span>
        <slot name="after-variable" />
      </template>
    </NumberField>
  </BindableValueRoot>
</template>
