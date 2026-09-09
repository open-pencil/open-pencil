<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { reasoningDisplay } from '@/app/ai/chat/preferences'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsSectionHeader from '@/components/settings/layout/SettingsSectionHeader.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { ai } = useI18n()
const options = computed(() => [
  { value: 'collapsed' as const, label: ai.value.reasoningCollapsed },
  { value: 'while-thinking' as const, label: ai.value.reasoningWhileThinking },
  { value: 'expanded' as const, label: ai.value.reasoningExpanded }
])
</script>

<template>
  <section class="mt-4 flex flex-col gap-3">
    <SettingsSectionHeader>{{ ai.chatSettings }}</SettingsSectionHeader>
    <SettingsGroup>
      <label class="flex flex-wrap items-center justify-between gap-4 px-3 py-2.5">
        <span class="text-xs text-surface">{{ ai.reasoningDisplay }}</span>
        <AppSelect
          v-model="reasoningDisplay"
          :label="ai.reasoningDisplay"
          :options="options"
          class="w-44"
        />
      </label>
    </SettingsGroup>
  </section>
</template>
