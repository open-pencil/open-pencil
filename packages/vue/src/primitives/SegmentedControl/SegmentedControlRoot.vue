<script setup lang="ts">
import { computed } from 'vue'
import { RovingFocusGroup, ToggleGroupRoot } from 'reka-ui'

import { provideSegmentedControl } from '#vue/primitives/SegmentedControl/context'
import type {
  SegmentedControlRootProps,
  SegmentedControlRootSlots
} from '#vue/primitives/SegmentedControl/types'

const {
  mode: modeProp = 'single',
  modelValue: modelValueProp,
  orientation = 'horizontal',
  disabled: disabledProp = false,
  required = false,
  rovingFocus = true,
  loop = true
} = defineProps<SegmentedControlRootProps>()

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | undefined]
  action: [value: string]
}>()
defineSlots<SegmentedControlRootSlots>()
defineOptions({ inheritAttrs: false })

const mode = computed(() => modeProp)
const modelValue = computed(() => modelValueProp)
const disabled = computed(() => disabledProp)

function selected(value: string): boolean {
  if (Array.isArray(modelValue.value)) return modelValue.value.includes(value)
  return modelValue.value === value
}

function activate(value: string) {
  if (!disabled.value) emit('action', value)
}

function updateSingle(value: unknown) {
  if (required && typeof value !== 'string') return
  emit('update:modelValue', typeof value === 'string' ? value : undefined)
}

function updateMultiple(value: unknown) {
  if (!Array.isArray(value)) return
  emit(
    'update:modelValue',
    value.filter((item): item is string => typeof item === 'string')
  )
}

provideSegmentedControl({ mode, modelValue, disabled, selected, activate })
</script>

<template>
  <ToggleGroupRoot
    v-if="mode === 'single'"
    v-bind="$attrs"
    type="single"
    :model-value="typeof modelValue === 'string' ? modelValue : undefined"
    :orientation="orientation"
    :disabled="disabled"
    :required="required"
    :roving-focus="rovingFocus"
    :loop="loop"
    data-slot="root"
    data-mode="single"
    @update:model-value="updateSingle"
  >
    <slot :mode="mode" :model-value="modelValue" />
  </ToggleGroupRoot>

  <ToggleGroupRoot
    v-else-if="mode === 'multiple'"
    v-bind="$attrs"
    type="multiple"
    :model-value="Array.isArray(modelValue) ? modelValue : []"
    :orientation="orientation"
    :disabled="disabled"
    :roving-focus="rovingFocus"
    :loop="loop"
    data-slot="root"
    data-mode="multiple"
    @update:model-value="updateMultiple"
  >
    <slot :mode="mode" :model-value="modelValue" />
  </ToggleGroupRoot>

  <RovingFocusGroup
    v-else
    v-bind="$attrs"
    :orientation="orientation"
    :loop="loop"
    role="group"
    data-slot="root"
    data-mode="action"
  >
    <slot :mode="mode" :model-value="modelValue" />
  </RovingFocusGroup>
</template>
