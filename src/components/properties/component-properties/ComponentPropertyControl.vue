<script setup lang="ts">
import { MIXED, useI18n } from '@open-pencil/vue'
import type { ComponentPropertyControl } from '@open-pencil/vue'

import type { AppPickerItem } from '@/components/ui/select/AppPicker.vue'
import AppPickerField from '@/components/ui/select/AppPickerField.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import ComponentPropertyTextField from './ComponentPropertyTextField.vue'

/** The value control of one instance property, in the right column of its row. */
const { control } = defineProps<{ control: ComponentPropertyControl }>()
const emit = defineEmits<{
  set: [propertyId: string, value: string]
  text: [propertyId: string, value: string]
  flush: []
}>()
const { panels, common } = useI18n()

function preferredGroup(preferred: boolean | undefined) {
  return preferred ? panels.value.preferredInstances : panels.value.allInstances
}

/** Swap choices with the definition's preferred components first, as Figma lists them. */
function swapItems(): AppPickerItem[] {
  const anyPreferred = control.options.some((option) => option.preferred)
  return control.options.map((option) => ({
    value: option.value,
    label: option.label,
    disabled: option.disabled,
    group: anyPreferred ? preferredGroup(option.preferred) : undefined
  }))
}

function selectOptions() {
  return control.value === MIXED
    ? [{ value: 'MIXED', label: panels.value.mixed }, ...control.options]
    : control.options
}
</script>

<template>
  <div v-if="control.type === 'BOOLEAN'" class="flex">
    <AppSwitch
      :model-value="control.value !== MIXED && control.value === 'true'"
      :label="control.name"
      :state="control.value === MIXED ? 'mixed' : 'idle'"
      :data-property="control.id"
      @update:model-value="emit('set', control.id, String($event))"
    />
  </div>
  <ComponentPropertyTextField
    v-else-if="control.type === 'TEXT'"
    :value="control.value"
    :label="control.name"
    :data-property="control.id"
    @update="emit('text', control.id, $event)"
    @commit="emit('flush')"
  />
  <AppPickerField
    v-else-if="control.type === 'INSTANCE_SWAP'"
    :model-value="control.value === MIXED ? '' : control.value"
    :items="swapItems()"
    :label="control.name"
    :placeholder="control.value === MIXED ? panels.mixed : undefined"
    :search-placeholder="panels.searchInstances"
    :empty-label="panels.noComponentsFound"
    :close-label="common.close"
    :data-property="control.id"
    @update:model-value="emit('set', control.id, $event)"
  />
  <AppSelect
    v-else
    :label="control.name"
    :model-value="control.value === MIXED ? 'MIXED' : control.value"
    :options="selectOptions()"
    :data-property="control.id"
    @update:model-value="$event !== 'MIXED' && emit('set', control.id, $event)"
  />
</template>
