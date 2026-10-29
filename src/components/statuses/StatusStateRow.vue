<script setup lang="ts">
import { computed, ref } from 'vue'

import { colorToHex } from '@open-pencil/scene-graph/color'
import { figmaDevStatusOf, type StatusState } from '@open-pencil/scene-graph/statuses'
import { useStatusMessages } from '@open-pencil/vue/i18n'

import { STATUS_COLORS } from '@/app/editor/statuses/workflow'
import StatusDot from '@/components/statuses/StatusDot.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { statusRows } from './ui'

/** One status in the Statuses dialog: its color and name. */
const { state, states } = defineProps<{
  state: StatusState
  states: readonly StatusState[]
}>()
const emit = defineEmits<{
  rename: [name: string]
  color: [color: StatusState['color']]
  remove: []
}>()

const messages = useStatusMessages()
const ui = statusRows()
const draft = ref<string | null>(null)

const colorOptions = STATUS_COLORS.map((color) => ({
  value: colorToHex(color),
  label: colorToHex(color)
}))
const figma = computed(() => {
  const status = figmaDevStatusOf(state.id)
  if (!status) return ''
  const name = status === 'READY_FOR_DEV' ? messages.value.readyForDev : messages.value.completed
  return messages.value.figmaShows({ status: name })
})
function commitName() {
  if (draft.value !== null && draft.value.trim() && draft.value !== state.name) {
    emit('rename', draft.value)
  }
  draft.value = null
}
</script>

<template>
  <div :class="ui.row()" data-test-id="status-state-row" :data-state-id="state.id">
    <icon-lucide-grip-vertical :class="ui.handle()" aria-hidden="true" />
    <AppSelect
      :model-value="colorToHex(state.color)"
      :options="colorOptions"
      :label="messages.color"
      placement="below"
      @update:model-value="
        emit('color', STATUS_COLORS.find((color) => colorToHex(color) === $event) ?? state.color)
      "
    >
      <template #trigger>
        <IconButton :label="messages.color">
          <StatusDot :color="state.color" />
        </IconButton>
      </template>
      <template #option="{ option }">
        <span class="flex items-center gap-2">
          <StatusDot :color="STATUS_COLORS.find((color) => colorToHex(color) === option.value)" />
          {{ option.label }}
        </span>
      </template>
    </AppSelect>
    <AppInput
      :model-value="draft ?? state.name"
      size="sm"
      tone="panel"
      :aria-label="messages.name"
      @update:model-value="draft = String($event)"
      @change="commitName"
      @enter="commitName"
    />
    <IconButton
      :label="messages.deleteStatus"
      :disabled="states.length < 2"
      @click="emit('remove')"
    >
      <icon-lucide-minus class="size-3.5" />
    </IconButton>
    <p v-if="figma" :class="ui.hint()">{{ figma }}</p>
  </div>
</template>
