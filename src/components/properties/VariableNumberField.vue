<script setup lang="ts">
import { computed, useAttrs } from 'vue'

import {
  useNumberBindingProvider,
  type BindingTarget
} from '@open-pencil/vue/controls/binding-provider'
import type { NumberBindingPath } from '@open-pencil/vue/controls/number-variable-binding'
import { useI18n } from '@open-pencil/vue/i18n'
import { BindableValueRoot } from '@open-pencil/vue/primitives/BindableValue'

import NumberField from '@/components/inputs/NumberField.vue'
import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import { BindingPill, useBindingFieldUI } from '@/components/ui/binding'

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
  nodeIds,
  bindingPath,
  bindingPaths,
  units,
  round
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
  /** Every layer the field edits, when it is more than `nodeId`; a variable binds to all. */
  nodeIds?: readonly string[]
  bindingPath: NumberBindingPath
  bindingPaths?: readonly NumberBindingPath[]
  /** Units a typed value may end with; the commit reports the one typed. */
  units?: readonly string[]
  /** How a bound value is shown and edited from, as the unbound value the caller passes is. */
  round?: (value: number) => number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number, unit?: string]
  commit: [value: number, previous: number, unit?: string]
  cancel: []
}>()

const { panels, common } = useI18n()
const provider = useNumberBindingProvider()
const attrs = useAttrs()
const targets = computed<BindingTarget[]>(() =>
  (nodeIds ?? [nodeId]).flatMap((id) =>
    (bindingPaths ?? [bindingPath]).map((path) => ({ nodeId: id, path }))
  )
)
const accessibleLabel = computed(() => {
  const ariaLabel = attrs['aria-label']
  return typeof ariaLabel === 'string' ? ariaLabel : (label ?? bindingPath)
})
const bindingStyles = useBindingFieldUI()

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
      :units="units"
      :round="round"
      :ui="{ root: bindingStyles.root }"
      :data-property="bindingPath"
      :aria-label="accessibleLabel"
      @update:model-value="(value: number, unit?: string) => emit('update:modelValue', value, unit)"
      @commit="
        (value: number, previous: number, unit?: string) => emit('commit', value, previous, unit)
      "
      @cancel="emit('cancel')"
    >
      <template v-if="$slots.icon" #icon>
        <slot name="icon" />
      </template>
      <template v-if="$slots.display" #display="display">
        <slot name="display" v-bind="display" />
      </template>
      <!-- A bound number reads like any other, its variable named by the variable button's
           tooltip; with no value to show, an unresolved binding names its variable. -->
      <template v-if="binding.state === 'unresolved'" #bound>
        <BindingPill
          unresolved
          :label="binding.variable?.name ?? binding.bindingId ?? panels.unresolvedVariable"
          :tooltip="panels.unresolvedVariable"
        />
      </template>
      <template #suffix>
        <!-- A field's own control, such as Hug or a mode menu, sits beside its value; the variable
             button ends every field, so it lines up down the panel. -->
        <slot name="after-variable" />
        <span class="flex items-center pe-1">
          <VariableBindingPicker
            :trigger-label="panels.applyVariable"
            :search-placeholder="common.search"
            :empty-label="panels.noVariablesFound"
            :detach-label="panels.detachVariable"
            :create-label="
              panels.createNumberVariable({
                value: typeof modelValue === 'number' ? modelValue : 0
              })
            "
            :create-name-placeholder="panels.variableName"
            :create-submit-label="panels.create"
          />
        </span>
      </template>
    </NumberField>
  </BindableValueRoot>
</template>
