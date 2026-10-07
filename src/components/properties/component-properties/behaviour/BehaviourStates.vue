<script setup lang="ts">
import { computed } from 'vue'

import { INTERACTION_STATES, type InteractionState } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'
import type { BehaviourStatesControl } from '@open-pencil/vue'

import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppPickerField from '@/components/ui/select/AppPickerField.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import BehaviourBindingField from './BehaviourBindingField.vue'
import { useBehaviourLabels } from './labels'

/**
 * Which variant property draws the control's interaction states, and which of its values is
 * each state. A state set to None shows the default value. A component without variant
 * properties offers to add a variant for each state instead.
 */
const { states } = defineProps<{ states: BehaviourStatesControl }>()
const emit = defineEmits<{
  bind: [propertyId: string]
  map: [state: InteractionState, value: string]
  create: []
}>()
const { panels, common } = useI18n()
const labels = useBehaviourLabels()

/** Stands for "no value" in a select, which cannot hold an empty string and never a number. */
const UNSET = -1

const properties = computed(() =>
  states.options.map((option) => ({ value: option.id, label: option.name }))
)
const values = computed<{ value: string | number; label: string }[]>(() => {
  const property = states.options.find((option) => option.id === states.propertyId)
  return [
    { value: UNSET, label: panels.value.behaviourStateUnset },
    ...(property?.values ?? []).map((value) => ({ value, label: value }))
  ]
})

function map(state: InteractionState, value: string | number) {
  emit('map', state, typeof value === 'string' ? value : '')
}
</script>

<template>
  <div class="flex flex-col gap-1.5" data-property="behaviour-states">
    <div class="text-[11px] text-muted">{{ panels.behaviourStates }}</div>
    <template v-if="!states.options.length">
      <p class="text-[11px] leading-4 text-muted">{{ panels.behaviourStatesHint }}</p>
      <BehaviourBindingField
        :label="panels.behaviourStates"
        :property-id="null"
        :options="[]"
        :placeholder="panels.behaviourChooseProperty"
        :empty-label="panels.noComponentProperties"
        :create-label="panels.behaviourAddStates"
        data-property="behaviour-states-create"
        @bind="emit('bind', $event)"
        @create="emit('create')"
      />
    </template>
    <AppPickerField
      v-else
      :model-value="states.propertyId ?? ''"
      :items="properties"
      :label="panels.behaviourStates"
      :placeholder="panels.behaviourChooseProperty"
      :search-placeholder="panels.searchComponentProperties"
      :empty-label="panels.noComponentProperties"
      :close-label="common.close"
      data-property="behaviour-states-property"
      @update:model-value="emit('bind', $event)"
    />
    <div v-if="states.propertyId" class="grid grid-cols-2 gap-x-1 gap-y-1.5">
      <PanelFieldGroup
        v-for="state in INTERACTION_STATES"
        :key="state"
        :label="labels.state(state)"
      >
        <AppSelect
          :label="panels.behaviourStateField({ state: labels.state(state) })"
          :model-value="states.values[state] ?? UNSET"
          :options="values"
          :data-property="`behaviour-state-${state}`"
          @update:model-value="map(state, $event)"
        />
      </PanelFieldGroup>
    </div>
  </div>
</template>
