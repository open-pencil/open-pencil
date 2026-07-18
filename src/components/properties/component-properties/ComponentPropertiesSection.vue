<script setup lang="ts">
import { computed } from 'vue'

import { MIXED, useComponentProperties, useI18n } from '@open-pencil/vue'

import ComponentPropertyTextField from './ComponentPropertyTextField.vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const { active, controls, setValue } = useComponentProperties()
const { panels } = useI18n()
const componentSectionUI = { title: 'text-component' }

function selectOptions(control: (typeof controls.value)[number]) {
  return control.value === MIXED
    ? [{ value: 'MIXED', label: panels.value.mixed }, ...control.options]
    : control.options
}

function selectValue(control: (typeof controls.value)[number]) {
  return control.value === MIXED ? 'MIXED' : control.value
}

function updateSelect(propertyId: string, value: string) {
  if (value !== 'MIXED') setValue(propertyId, value)
}

function booleanValue(control: (typeof controls.value)[number]) {
  return control.value !== MIXED && control.value === 'true'
}

const sectionLabel = computed(() =>
  controls.value.every((control) => control.type === 'VARIANT')
    ? panels.value.variants
    : panels.value.componentProperties
)
</script>

<template>
  <PanelSection v-if="active" :label="sectionLabel" :ui="componentSectionUI">
    <div class="flex flex-col gap-1.5">
      <PanelFieldGroup v-for="control in controls" :key="control.id" :label="control.name">
        <ComponentPropertyTextField
          v-if="control.type === 'TEXT'"
          :value="control.value"
          :label="control.name"
          :data-property="control.id"
          @commit="setValue(control.id, $event)"
        />
        <div v-else-if="control.type === 'BOOLEAN'" class="flex h-field items-center">
          <AppSwitch
            :model-value="booleanValue(control)"
            :label="control.name"
            :state="control.value === MIXED ? 'mixed' : 'idle'"
            :data-property="control.id"
            @update:model-value="setValue(control.id, String($event))"
          />
        </div>
        <AppSelect
          v-else
          :label="control.name"
          :model-value="selectValue(control)"
          :options="selectOptions(control)"
          :data-property="control.id"
          @update:model-value="updateSelect(control.id, $event)"
        />
      </PanelFieldGroup>
    </div>
  </PanelSection>
</template>
