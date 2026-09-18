<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { maxAgentSteps, reasoningDisplay } from '@/app/ai/chat/preferences'
import { AGENT_STEP_LIMIT_MIN, AGENT_STEP_LIMIT_MAX } from '@/app/ai/chat/step-limit'
import { openToolAccessSettings } from '@/app/automation/tool-access/settings/use'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import PresetNumberField from '@/components/ui/input/PresetNumberField.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { ai, settings } = useI18n()
const stepPresets = [25, 50, 100, 200]
const limitMessage = computed(() =>
  ai.value.maxAgentStepsRange({ min: AGENT_STEP_LIMIT_MIN, max: AGENT_STEP_LIMIT_MAX })
)
const options = computed(() => [
  { value: 'collapsed' as const, label: ai.value.reasoningCollapsed },
  { value: 'while-thinking' as const, label: ai.value.reasoningWhileThinking },
  { value: 'expanded' as const, label: ai.value.reasoningExpanded }
])
</script>

<template>
  <SettingsSection>
    <template #title>{{ ai.chatSettings }}</template>
    <SettingsGroup>
      <SettingsRow :label="ai.reasoningDisplay" class="max-sm:flex-col max-sm:items-stretch">
        <AppSelect
          v-model="reasoningDisplay"
          :label="ai.reasoningDisplay"
          :options="options"
          :ui="{ trigger: 'w-full sm:w-52' }"
        />
      </SettingsRow>
      <SettingsRow
        :label="ai.maxAgentSteps"
        :description="ai.maxAgentStepsHint"
        class="max-sm:flex-col max-sm:items-stretch"
      >
        <PresetNumberField
          v-model:number="maxAgentSteps"
          :presets="stepPresets"
          :min="AGENT_STEP_LIMIT_MIN"
          :max="AGENT_STEP_LIMIT_MAX"
          :label="ai.maxAgentSteps"
          :custom-label="ai.maxAgentStepsCustom"
          :range-message="limitMessage"
        />
      </SettingsRow>
    </SettingsGroup>
    <SettingsGroup>
      <SettingsRow :label="settings.toolAccess">
        <AppButton size="xs" variant="outline" @click="openToolAccessSettings('ai')">{{
          settings.toolAccess
        }}</AppButton>
      </SettingsRow>
    </SettingsGroup>
  </SettingsSection>
</template>
