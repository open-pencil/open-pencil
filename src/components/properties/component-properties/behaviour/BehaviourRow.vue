<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import type { BehaviourKind } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'
import type {
  BehaviourBooleanControl,
  BehaviourNumberControl,
  BehaviourPartControl,
  BehaviourValueControl
} from '@open-pencil/vue'

import AppInput from '@/components/ui/input/AppInput.vue'
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

/** Number fields being typed in, reset whenever the value changes. */
const drafts = reactive<Record<string, string | number>>({})
watch(
  value,
  (current) => {
    if (current?.type === 'number')
      for (const field of NUMBER_FIELDS) drafts[field] = current[field]
  },
  { immediate: true, deep: true }
)

function setNumberField(number: BehaviourNumberControl, field: (typeof NUMBER_FIELDS)[number]) {
  const input = drafts[field] ?? ''
  const parsed = typeof input === 'number' ? input : Number.parseFloat(input)
  if (!Number.isFinite(parsed)) return
  const { id: _id, type: _type, ...settings } = number
  emit('setNumber', { ...settings, [field]: parsed })
}

function numberLabel(field: (typeof NUMBER_FIELDS)[number]) {
  const p = panels.value
  return {
    min: p.behaviourMin,
    max: p.behaviourMax,
    step: p.behaviourStep,
    default: p.behaviourDefault
  }[field]
}
</script>

<template>
  <PanelFieldGroup :label="label" :data-row="id">
    <BehaviourBindingField
      v-if="part"
      :label="label"
      :property-id="part.propertyId"
      :options="part.options"
      :placeholder="panels.behaviourChooseSlot"
      :empty-label="panels.behaviourNoSlots"
      :create-label="part.creatable ? panels.behaviourAddSlot({ name: label }) : undefined"
      :hint="panels.behaviourNoSlots"
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
        :create-label="value.creatable ? panels.behaviourAddVariants : undefined"
        :hint="panels.behaviourNeedsVariants"
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
    <div
      v-else-if="value?.type === 'number'"
      class="grid grid-cols-4 gap-1"
      :data-property="`behaviour-value-${id}`"
    >
      <AppInput
        v-for="field in NUMBER_FIELDS"
        :key="field"
        v-model="drafts[field]"
        type="number"
        size="sm"
        tone="panel"
        :aria-label="numberLabel(field)"
        :placeholder="numberLabel(field)"
        @change="setNumberField(value, field)"
      />
    </div>
  </PanelFieldGroup>
</template>
