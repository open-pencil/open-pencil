<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import type { BehaviourKind, InteractionState } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'
import type {
  BehaviourBooleanControl,
  BehaviourControl,
  BehaviourNumberControl
} from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import SeverityIcon from '@/components/ui/feedback/SeverityIcon.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import type { AppPickerItem } from '@/components/ui/select/AppPicker.vue'
import AppPickerField from '@/components/ui/select/AppPickerField.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import AddBehaviourPicker from './AddBehaviourPicker.vue'
import BehaviourStates from './BehaviourStates.vue'
import { useBehaviourLabels } from './labels'

/**
 * The behaviour of the selected main component: which control it acts as, which of its
 * properties hold the control's values, and which of its slots are the control's parts.
 */
const { behaviour } = defineProps<{ behaviour: BehaviourControl | null }>()
const emit = defineEmits<{
  add: [kind: BehaviourKind]
  remove: []
  bindValue: [valueId: string, propertyId: string]
  mapValue: [valueId: string, mapping: { on: string; off: string }]
  setNumber: [valueId: string, settings: Omit<BehaviourNumberControl, 'id' | 'type'>]
  bindPart: [partId: string, propertyId: string]
  bindStates: [propertyId: string]
  mapState: [state: InteractionState, value: string]
}>()
const { panels, common } = useI18n()
const labels = useBehaviourLabels()

function propertyItems(control: { options: { id: string; name: string }[] }): AppPickerItem[] {
  return control.options.map((option) => ({ value: option.id, label: option.name }))
}

/** Variant values of the bound property, for choosing which mean on and off. */
function variantValues(value: BehaviourBooleanControl) {
  const option = value.options.find((item) => item.id === value.propertyId)
  return (option?.values ?? []).map((name) => ({ value: name, label: name }))
}

function setMapping(value: BehaviourBooleanControl, side: 'on' | 'off', choice: string) {
  emit('mapValue', value.id, {
    on: side === 'on' ? choice : (value.on ?? ''),
    off: side === 'off' ? choice : (value.off ?? '')
  })
}

const NUMBER_FIELDS = ['min', 'max', 'step', 'default'] as const

/** Number fields being typed in, by value id and field, reset whenever the behaviour changes. */
const drafts = reactive<Record<string, string | number>>({})
watch(
  () => behaviour,
  (current) => {
    for (const value of current?.values ?? [])
      if (value.type === 'number')
        for (const field of NUMBER_FIELDS) drafts[`${value.id}:${field}`] = value[field]
  },
  { immediate: true, deep: true }
)

function setNumberField(
  value: BehaviourNumberControl,
  field: (typeof NUMBER_FIELDS)[number],
  input: string | number
) {
  const parsed = typeof input === 'number' ? input : Number.parseFloat(input)
  if (!Number.isFinite(parsed)) return
  const { id: _id, type: _type, ...settings } = value
  emit('setNumber', value.id, { ...settings, [field]: parsed })
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

const kind = computed(() => (behaviour ? labels.value.kind(behaviour.kind) : null))
</script>

<template>
  <PanelSection :label="panels.behaviour" :empty="!behaviour">
    <template #actions>
      <AddBehaviourPicker v-if="!behaviour" @add="emit('add', $event)" />
      <IconButton v-else :label="panels.removeBehaviour" @click="emit('remove')">
        <icon-lucide-minus class="size-3.5" />
      </IconButton>
    </template>

    <div v-if="behaviour && kind" class="flex flex-col gap-2" data-property="behaviour">
      <div class="flex items-center gap-1.5 text-xs text-surface">
        <icon-lucide-mouse-pointer-click class="size-3.5 shrink-0 text-component" />
        <span class="min-w-0 flex-1 truncate font-medium">{{ kind.label }}</span>
        <span
          v-if="behaviour.missing"
          class="flex h-5 shrink-0 items-center gap-1 rounded bg-issue-warning/15 px-1.5 text-[10px] text-issue-warning"
          data-property="behaviour-missing"
        >
          <SeverityIcon severity="warning" />
          {{ panels.behaviourMissingCount(behaviour.missing) }}
        </span>
        <span
          v-else
          class="flex h-5 shrink-0 items-center gap-1 rounded bg-panel-field px-1.5 text-[10px] text-muted"
        >
          <icon-lucide-check class="size-3 text-success" />
          {{ panels.behaviourComplete }}
        </span>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="text-[11px] text-muted">{{ panels.behaviourValues }}</div>
        <PanelFieldGroup
          v-for="value in behaviour.values"
          :key="value.id"
          :label="labels.value(value.id)"
        >
          <template v-if="value.type === 'boolean'">
            <AppPickerField
              :model-value="value.propertyId ?? ''"
              :items="propertyItems(value)"
              :label="labels.value(value.id)"
              :placeholder="panels.behaviourChooseProperty"
              :search-placeholder="panels.searchComponentProperties"
              :empty-label="panels.noComponentProperties"
              :close-label="common.close"
              :data-property="`behaviour-value-${value.id}`"
              :data-missing="(value.required && !value.propertyId) || undefined"
              @update:model-value="emit('bindValue', value.id, $event)"
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
          <div v-else class="grid grid-cols-4 gap-1" :data-property="`behaviour-value-${value.id}`">
            <AppInput
              v-for="field in NUMBER_FIELDS"
              :key="field"
              v-model="drafts[`${value.id}:${field}`]"
              type="number"
              size="sm"
              tone="panel"
              :aria-label="numberLabel(field)"
              :placeholder="numberLabel(field)"
              @change="setNumberField(value, field, drafts[`${value.id}:${field}`] ?? '')"
            />
          </div>
        </PanelFieldGroup>
      </div>

      <div v-if="behaviour.parts.length" class="flex flex-col gap-1.5">
        <div class="text-[11px] text-muted">{{ panels.behaviourParts }}</div>
        <PanelFieldGroup
          v-for="part in behaviour.parts"
          :key="part.id"
          :label="labels.part(part.id)"
        >
          <AppPickerField
            :model-value="part.propertyId ?? ''"
            :items="propertyItems(part)"
            :label="labels.part(part.id)"
            :placeholder="panels.behaviourChooseSlot"
            :search-placeholder="panels.searchComponentProperties"
            :empty-label="panels.behaviourNoSlots"
            :close-label="common.close"
            :data-property="`behaviour-part-${part.id}`"
            :data-missing="(part.required && !part.propertyId) || undefined"
            @update:model-value="emit('bindPart', part.id, $event)"
          />
        </PanelFieldGroup>
      </div>

      <BehaviourStates
        :states="behaviour.states"
        @bind="emit('bindStates', $event)"
        @map="(state, value) => emit('mapState', state, value)"
      />
    </div>
  </PanelSection>
</template>
