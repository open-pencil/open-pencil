<script setup lang="ts">
import { MIXED } from '@open-pencil/vue/controls/node-props'
import type { VariableModeChoice } from '@open-pencil/vue/controls/variable-modes'
import { usePanelMessages } from '@open-pencil/vue/i18n'

import AppSelect from '@/components/ui/select/AppSelect.vue'
import type { AppSelectGroup } from '@/components/ui/select/select'

import ComponentPropertyRow from '../component-properties/ComponentPropertyRow.vue'
import { AUTO_MODE, autoModeLabel } from './labels'

/**
 * A row for each collection the layers can show a mode of, such as a frame's theme: its name, then
 * Auto (the inherited mode, which also clears one the layers set) or a mode.
 */
const { choices } = defineProps<{ choices: VariableModeChoice[] }>()
const emit = defineEmits<{ set: [collectionId: string, modeId: string | null] }>()

const panels = usePanelMessages()
const MIXED_MODE = ':mixed'

function groups(choice: VariableModeChoice): AppSelectGroup<string>[] {
  const mixed =
    choice.value === MIXED ? [{ options: [{ value: MIXED_MODE, label: panels.value.mixed }] }] : []
  return [
    ...mixed,
    { options: [{ value: AUTO_MODE, label: autoModeLabel(panels.value, choice) }] },
    {
      label: panels.value.variableModeHeading,
      options: choice.modes.map((mode) => ({ value: mode.modeId, label: mode.name }))
    }
  ]
}

function current(choice: VariableModeChoice): string {
  if (choice.value === MIXED) return MIXED_MODE
  return choice.value ?? AUTO_MODE
}

function select(choice: VariableModeChoice, value: string) {
  if (value === MIXED_MODE) return
  emit('set', choice.collectionId, value === AUTO_MODE ? null : value)
}
</script>

<template>
  <div v-if="choices.length > 0" class="mt-1.5 flex flex-col gap-1">
    <ComponentPropertyRow
      v-for="choice in choices"
      :key="choice.collectionId"
      :name="choice.name"
      data-variable-mode-row
    >
      <AppSelect
        :model-value="current(choice)"
        :label="choice.name"
        :groups="groups(choice)"
        @update:model-value="(value: string) => select(choice, value)"
      />
    </ComponentPropertyRow>
  </div>
</template>
