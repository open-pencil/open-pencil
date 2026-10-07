<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { isNumberRange, type BehaviourKind } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'
import type {
  BehaviourBooleanControl,
  BehaviourNumberControl,
  BehaviourPartControl,
  BehaviourValueControl
} from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import BehaviourBindingField from './BehaviourBindingField.vue'
import { useBehaviourLabels } from './labels'

/** One row of the Behaviour section: a value of the control, or one of its parts. */
const { kind, row } = defineProps<{
  kind: BehaviourKind
  row: { part: BehaviourPartControl } | { value: BehaviourValueControl }
}>()
const emit = defineEmits<{
  bind: [propertyId: string]
  create: [name: string]
  mapValue: [mapping: { on: string; off: string }]
  setNumber: [settings: Omit<BehaviourNumberControl, 'id' | 'type'>]
}>()
const { panels } = useI18n()
const labels = useBehaviourLabels()

const part = computed(() => ('part' in row ? row.part : null))
const value = computed(() => ('value' in row ? row.value : null))
/** A row the control requires that is still unbound; its label shows it. */
const missing = computed(() => {
  const control = part.value ?? value.value
  return !!control && 'required' in control && control.required && !control.propertyId
})
const number = computed(() => (value.value?.type === 'number' ? value.value : null))
const id = computed(() => part.value?.id ?? value.value?.id ?? '')
const label = computed(() =>
  part.value ? labels.value.part(id.value) : labels.value.valueOf(kind, id.value)
)

/** Variant values of the bound property, for choosing which mean on and off. */
function variantValues(boolean: BehaviourBooleanControl) {
  const option = boolean.options.find((item) => item.id === boolean.propertyId)
  return (option?.values ?? []).map((name) => ({ value: name, label: name }))
}

function setMapping(boolean: BehaviourBooleanControl, side: 'on' | 'off', choice: string) {
  emit('mapValue', {
    on: side === 'on' ? choice : (boolean.on ?? ''),
    off: side === 'off' ? choice : (boolean.off ?? '')
  })
}

const NUMBER_FIELDS = ['min', 'max', 'step', 'default'] as const
type NumberSetting = (typeof NUMBER_FIELDS)[number]

/** Number fields as they are scrubbed, reset whenever the value changes. */
const drafts = reactive<Partial<Record<NumberSetting, number>>>({})
watch(
  value,
  (current) => {
    if (current?.type === 'number')
      for (const field of NUMBER_FIELDS) drafts[field] = current[field]
  },
  { immediate: true, deep: true }
)

/** Keep a range a slider can step through; any other puts the field back. */
function commitNumber(number: BehaviourNumberControl, field: NumberSetting, input: number) {
  const { id: _id, type: _type, ...settings } = number
  const next = { ...settings, [field]: input }
  if (isNumberRange(next)) emit('setNumber', next)
  else drafts[field] = number[field]
}

function numberLabel(field: NumberSetting) {
  const p = panels.value
  return {
    min: p.behaviourMin,
    max: p.behaviourMax,
    step: p.behaviourStep,
    default: p.behaviourStart
  }[field]
}
</script>

<template>
  <PanelFieldGroup
    :label="label"
    :data-row="id"
    :data-missing="missing || undefined"
    :ui="{ root: 'group', label: 'group-data-[missing]:text-issue-warning' }"
  >
    <BehaviourBindingField
      v-if="part"
      :label="label"
      :property-id="part.propertyId"
      :options="part.options"
      :placeholder="panels.behaviourChooseSlot"
      :empty-label="panels.behaviourNoSlots"
      :create-label="panels.behaviourAddSlot({ name: label })"
      :missing="part.required"
      :data-property="`behaviour-part-${id}`"
      @bind="emit('bind', $event)"
      @create="emit('create', label)"
    />
    <template v-else-if="value?.type === 'boolean'">
      <BehaviourBindingField
        :label="label"
        :property-id="value.propertyId"
        :options="value.options"
        :placeholder="panels.behaviourChooseProperty"
        :empty-label="panels.noComponentProperties"
        :create-label="panels.behaviourAddVariants"
        :missing="value.required"
        :data-property="`behaviour-value-${id}`"
        @bind="emit('bind', $event)"
        @create="emit('create', label)"
      />
      <div
        v-if="value.propertyId && variantValues(value).length"
        class="mt-1 grid grid-cols-2 gap-1"
      >
        <AppSelect
          :label="panels.behaviourOnValue"
          :model-value="value.on ?? ''"
          :options="variantValues(value)"
          @update:model-value="setMapping(value, 'on', $event)"
        />
        <AppSelect
          :label="panels.behaviourOffValue"
          :model-value="value.off ?? ''"
          :options="variantValues(value)"
          @update:model-value="setMapping(value, 'off', $event)"
        />
      </div>
    </template>
    <BehaviourBindingField
      v-else-if="value?.type === 'text'"
      :label="label"
      :property-id="value.propertyId"
      :options="value.options"
      :placeholder="panels.behaviourChooseProperty"
      :empty-label="panels.noComponentProperties"
      :create-label="panels.behaviourAddTextLayer"
      :missing="value.required"
      :data-property="`behaviour-value-${id}`"
      @bind="emit('bind', $event)"
      @create="emit('create', label)"
    />
    <div v-else-if="number" class="grid grid-cols-2 gap-1" :data-property="`behaviour-value-${id}`">
      <NumberField
        v-for="field in NUMBER_FIELDS"
        :key="field"
        :label="numberLabel(field)"
        :aria-label="numberLabel(field)"
        :model-value="drafts[field] ?? number[field]"
        :data-property="`behaviour-number-${field}`"
        @update:model-value="drafts[field] = $event"
        @commit="(input: number) => number && commitNumber(number, field, input)"
        @cancel="drafts[field] = number[field]"
      />
    </div>
  </PanelFieldGroup>
</template>
