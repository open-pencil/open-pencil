<script setup lang="ts">
import { computed } from 'vue'

import type { AgentChoiceCategory } from '@/app/ai/agents/acp/options'
import {
  chatAgentChoices,
  chatAgentDefaults,
  chatAgentOptions,
  chooseAgentOption
} from '@/app/ai/chat/thinking'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { chatAgentTheme, chatProfileTheme } from '../ui'

/**
 * How the Design agent works on the next message, such as Claude Code's Plan, by the agent's own
 * names. It reads as a word at every width: it is the choice that decides what a message does.
 */
const { category } = defineProps<{ category: AgentChoiceCategory }>()

const profile = chatProfileTheme()
const ui = chatAgentTheme()
const offered = computed(() => chatAgentOptions.value?.[category] ?? null)
const options = computed(() =>
  (offered.value?.values ?? []).map((value) => ({
    value: value.id,
    label: value.name,
    description: value.description ?? ''
  }))
)
/** The chat's choice, or the value the agent runs on while it names none. */
const selected = computed({
  get: () => chatAgentChoices.value[category] || offered.value?.current || '',
  set: (value: string) => chooseAgentOption(category, value)
})
const selectedLabel = computed(
  () => options.value.find((option) => option.value === selected.value)?.label ?? selected.value
)
/** A mode other than the agent's own reads brighter, so a Plan left on is hard to miss. */
const changed = computed(() => {
  const own = chatAgentDefaults.value[category]
  return own !== undefined && selected.value !== own
})
function descriptionOf(value: string): string {
  return options.value.find((option) => option.value === value)?.description ?? ''
}
</script>

<template>
  <AppSelect
    v-if="options.length > 0"
    v-model="selected"
    :label="`${offered?.name ?? ''}: ${selectedLabel}`"
    :options="options"
    :ui="{ content: ui.modeContent(), item: profile.item() }"
    data-test-id="chat-agent-mode"
  >
    <template #trigger>
      <button type="button" :class="ui.control({ changed })" :data-changed="changed || undefined">
        <span :class="ui.value()">{{ selectedLabel }}</span>
        <icon-lucide-chevron-down :class="ui.chevron()" aria-hidden="true" />
      </button>
    </template>
    <template #option="{ option }">
      <span :class="profile.text()">
        <span :class="profile.name()">{{ option.label }}</span>
        <span v-if="descriptionOf(option.value)" :class="ui.description()">
          {{ descriptionOf(option.value) }}
        </span>
      </span>
    </template>
  </AppSelect>
</template>
