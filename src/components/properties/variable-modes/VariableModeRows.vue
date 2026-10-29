<script setup lang="ts">
import { MIXED } from '@open-pencil/vue/controls/node-props'
import type { VariableModeChoice } from '@open-pencil/vue/controls/variable-modes'
import { usePanelMessages } from '@open-pencil/vue/i18n'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import type { AppSelectGroup } from '@/components/ui/select/select'

import { AUTO_MODE, autoModeLabel } from './labels'

/** A row for each collection a mode is set for: its name, Auto or a mode, and a remove button. */
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
  <div
    v-for="choice in choices"
    :key="choice.collectionId"
    class="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
    data-variable-mode-row
  >
    <span class="truncate text-[11px] text-muted">{{ choice.name }}</span>
    <AppSelect
      :model-value="current(choice)"
      class="w-full"
      :label="choice.name"
      :groups="groups(choice)"
      @update:model-value="(value: string) => select(choice, value)"
    />
    <IconButton
      :label="panels.removeVariableMode({ collection: choice.name })"
      @click="emit('set', choice.collectionId, null)"
    >
      <icon-lucide-minus class="size-3.5" />
    </IconButton>
  </div>
</template>
