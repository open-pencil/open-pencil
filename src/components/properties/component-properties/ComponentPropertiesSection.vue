<script setup lang="ts">
import { computed } from 'vue'

import { MIXED, useComponentProperties, useI18n, useSlotProperties } from '@open-pencil/vue'

import AssetThumbnail from '@/components/assets-panel/AssetThumbnail.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import type { AppPickerItem } from '@/components/ui/select/AppPicker.vue'
import AppPickerField from '@/components/ui/select/AppPickerField.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import ComponentPropertyTextField from './ComponentPropertyTextField.vue'
import SlotPropertyRow from './slot/SlotPropertyRow.vue'

const { active, controls, setValue, setTextValue, flush } = useComponentProperties()
const slotProperties = useSlotProperties()
const slots = slotProperties.slots
const visible = computed(() => active.value || slots.value.length > 0)
/** Thumbnail edge in the Add instances list, matching the picker's 32px tile. */
const SLOT_THUMBNAIL_SIZE = 32
const { panels, common } = useI18n()
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

/** Swap choices with the definition's preferred components first, as Figma lists them. */
function swapItems(control: (typeof controls.value)[number]): AppPickerItem[] {
  const anyPreferred = control.options.some((option) => option.preferred)
  const groupOf = (preferred: boolean | undefined) => {
    if (!anyPreferred) return undefined
    return preferred ? panels.value.preferredInstances : panels.value.allInstances
  }
  return control.options.map((option) => ({
    value: option.value,
    label: option.label,
    disabled: option.disabled,
    group: groupOf(option.preferred)
  }))
}

function booleanValue(control: (typeof controls.value)[number]) {
  return control.value !== MIXED && control.value === 'true'
}

const sectionLabel = computed(() =>
  slots.value.length === 0 && controls.value.every((control) => control.type === 'VARIANT')
    ? panels.value.variants
    : panels.value.componentProperties
)
</script>

<template>
  <PanelSection v-if="visible" :label="sectionLabel" :ui="componentSectionUI">
    <div class="flex flex-col gap-1.5">
      <PanelFieldGroup v-for="control in controls" :key="control.id" :label="control.name">
        <ComponentPropertyTextField
          v-if="control.type === 'TEXT'"
          :value="control.value"
          :label="control.name"
          :data-property="control.id"
          @update="setTextValue(control.id, $event)"
          @commit="flush"
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
        <AppPickerField
          v-else-if="control.type === 'INSTANCE_SWAP'"
          :model-value="control.value === MIXED ? '' : control.value"
          :items="swapItems(control)"
          :label="control.name"
          :placeholder="control.value === MIXED ? panels.mixed : undefined"
          :search-placeholder="panels.searchInstances"
          :empty-label="panels.noComponentsFound"
          :close-label="common.close"
          :data-property="control.id"
          @update:model-value="setValue(control.id, $event)"
        />
        <AppSelect
          v-else
          :label="control.name"
          :model-value="selectValue(control)"
          :options="selectOptions(control)"
          :data-property="control.id"
          @update:model-value="updateSelect(control.id, $event)"
        />
      </PanelFieldGroup>
      <SlotPropertyRow
        v-for="slot in slots"
        :key="slot.id"
        :name="slot.name"
        :modified="slot.modified"
        :item-count="slot.itemCount"
        :limits="slot.limits"
        :options="slotProperties.options(slot.id)"
        :preferred-only="slot.preferredOnly"
        @add="slotProperties.add(slot.frameId, $event)"
        @reset="slotProperties.reset(slot.frameId)"
        @delete-contents="slotProperties.clear(slot.frameId)"
        @select-layers="slotProperties.selectLayers(slot.offendingIds)"
      >
        <template #thumbnail="{ id }">
          <AssetThumbnail :node-id="id" alt="" :size="SLOT_THUMBNAIL_SIZE" />
        </template>
      </SlotPropertyRow>
    </div>
  </PanelSection>
</template>
