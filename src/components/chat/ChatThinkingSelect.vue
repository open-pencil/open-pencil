<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { chatThinkingLevel } from '@/app/ai/chat/thinking'
import { thinkingLevelLabel, thinkingLevelOptions } from '@/app/ai/models/thinking'
import ThinkingMeter from '@/components/chat/ThinkingMeter.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { chatProfileTheme } from '@/theme/chat/profile'
import { chatThinkingTheme } from '@/theme/chat/thinking'

const { ai } = useI18n()
const ui = chatProfileTheme()
const thinking = chatThinkingTheme()
const options = computed(() => thinkingLevelOptions(ai.value))
const selectedLabel = computed(() => thinkingLevelLabel(chatThinkingLevel.value, ai.value))
</script>

<template>
  <AppSelect
    v-model="chatThinkingLevel"
    :label="`${ai.thinkingLevel}: ${selectedLabel}`"
    :options="options"
    data-test-id="chat-thinking-selector"
  >
    <template #trigger>
      <button type="button" :class="ui.trigger({ class: thinking.trigger() })">
        <ThinkingMeter :level="chatThinkingLevel" />
        <span :class="thinking.label()">{{ selectedLabel }}</span>
        <icon-lucide-chevron-down :class="ui.triggerChevron()" aria-hidden="true" />
      </button>
    </template>
    <template #option-end="{ option }">
      <ThinkingMeter :level="option.value" :class="thinking.option()" />
    </template>
  </AppSelect>
</template>
