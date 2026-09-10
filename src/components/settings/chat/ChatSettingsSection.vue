<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { reasoningDisplay } from '@/app/ai/chat/preferences'
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
  <section class="mt-5 flex flex-col gap-3 border-t border-border pt-4">
    <SettingsSectionHeader>{{ ai.chatSettings }}</SettingsSectionHeader>
    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-3">
      <span class="text-[11px] text-surface">{{ ai.reasoningDisplay }}</span>
      <AppSelect v-model="reasoningDisplay" :label="ai.reasoningDisplay" :options="options" />
    </div>
  </section>
</template>
