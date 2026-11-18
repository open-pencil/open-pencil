<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

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
 * What the Design agent may do without asking, shown on the row only when the chat widened or
 * changed it from the agent's own, as Codex's Full access; the model menu holds it otherwise.
 */
const { category } = defineProps<{ category: AgentChoiceCategory }>()

const { ai } = useI18n()
const profile = chatProfileTheme()
const ui = chatAgentTheme()
const offered = computed(() => chatAgentOptions.value?.[category] ?? null)
const options = computed(() =>
  (offered.value?.values ?? []).map((value) => ({ value: value.id, label: value.name }))
)
const chosen = computed(() => chatAgentChoices.value[category] ?? '')
const selected = computed({
  get: () => chosen.value || offered.value?.current || '',
  set: (value: string) => chooseAgentOption(category, value)
})
const selectedLabel = computed(
  () => options.value.find((option) => option.value === selected.value)?.label ?? selected.value
)
/** Shown once the chat names access other than the agent's own. */
const shown = computed(() => {
  if (!chosen.value || options.value.length === 0) return false
  const own = chatAgentDefaults.value[category]
  return own === undefined || chosen.value !== own
})
</script>

<template>
  <AppSelect
    v-if="shown"
    v-model="selected"
    :label="`${ai.agentAccess}: ${selectedLabel}`"
    :options="options"
    :ui="{ item: profile.item() }"
    data-test-id="chat-agent-access"
  >
    <template #trigger>
      <button type="button" :class="ui.control()">
        <icon-lucide-shield-alert :class="ui.accessIcon()" aria-hidden="true" />
        <span :class="ui.accessLabel()">{{ selectedLabel }}</span>
      </button>
    </template>
  </AppSelect>
</template>
