<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { AgentChoiceCategory } from '@/app/ai/agents/acp/options'
import { chatAgentChoices, chatAgentOptions, chooseAgentOption } from '@/app/ai/chat/thinking'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { chatProfileTheme, chatThinkingTheme } from './ui'

/**
 * One of an ACP agent's options for the next message, such as its effort or mode, listed by the
 * agent's own names, since each agent and model offers its own. Shown while the agent offers it.
 */
const { category } = defineProps<{ category: AgentChoiceCategory }>()

const { ai } = useI18n()
const ui = chatProfileTheme()
const thinking = chatThinkingTheme()
const offered = computed(() => chatAgentOptions.value?.[category] ?? null)
const options = computed(() =>
  (offered.value?.values ?? []).map((value) => ({ value: value.id, label: value.name }))
)
const name = computed(() =>
  category === 'thought_level' ? ai.value.thinkingLevel : (offered.value?.name ?? category)
)
/** The chat's choice, or the value the agent runs on while it names none. */
const selected = computed({
  get: () => chatAgentChoices.value[category] || offered.value?.current || '',
  set: (value: string) => chooseAgentOption(category, value)
})
const selectedLabel = computed(
  () => options.value.find((option) => option.value === selected.value)?.label ?? selected.value
)
</script>

<template>
  <AppSelect
    v-if="options.length > 0"
    v-model="selected"
    :label="`${name}: ${selectedLabel}`"
    :options="options"
    :data-test-id="`chat-agent-option-${category}`"
  >
    <template #trigger>
      <button type="button" :class="ui.trigger({ class: thinking.trigger() })">
        <!-- Agents name their own values, so no bar count stands for them: narrow composers show this. -->
        <icon-lucide-brain
          v-if="category === 'thought_level'"
          :class="ui.triggerIcon()"
          aria-hidden="true"
        />
        <icon-lucide-shield-check
          v-else-if="category === 'mode'"
          :class="ui.triggerIcon()"
          aria-hidden="true"
        />
        <icon-lucide-list-checks v-else :class="ui.triggerIcon()" aria-hidden="true" />
        <span :class="thinking.label()">{{ selectedLabel }}</span>
        <icon-lucide-chevron-down :class="thinking.agentChevron()" aria-hidden="true" />
      </button>
    </template>
  </AppSelect>
</template>
