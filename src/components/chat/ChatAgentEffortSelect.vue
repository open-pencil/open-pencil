<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { chatAgentEffort, chatAgentEfforts } from '@/app/ai/chat/thinking'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { chatProfileTheme, chatThinkingTheme } from './ui'

/**
 * The effort of an ACP agent's model, listed by the agent's own names, since each agent and model
 * offers its own. Shown while the agent's model offers a choice.
 */
const { ai } = useI18n()
const ui = chatProfileTheme()
const thinking = chatThinkingTheme()
const options = computed(() =>
  (chatAgentEfforts.value?.values ?? []).map((value) => ({ value: value.id, label: value.name }))
)
/** The chat's choice, or the effort the agent runs on while it names none. */
const selected = computed({
  get: () => chatAgentEffort.value || chatAgentEfforts.value?.current || '',
  set: (effort: string) => {
    chatAgentEffort.value = effort
  }
})
const selectedLabel = computed(
  () => options.value.find((option) => option.value === selected.value)?.label ?? selected.value
)
</script>

<template>
  <AppSelect
    v-if="options.length > 0"
    v-model="selected"
    :label="`${ai.thinkingLevel}: ${selectedLabel}`"
    :options="options"
    data-test-id="chat-agent-effort-selector"
  >
    <template #trigger>
      <button type="button" :class="ui.trigger({ class: thinking.trigger() })">
        <!-- Agents name their own efforts, so no bar count stands for them: narrow composers show this. -->
        <icon-lucide-brain :class="ui.triggerIcon()" aria-hidden="true" />
        <span :class="thinking.label()">{{ selectedLabel }}</span>
        <icon-lucide-chevron-down :class="ui.triggerChevron()" aria-hidden="true" />
      </button>
    </template>
  </AppSelect>
</template>
