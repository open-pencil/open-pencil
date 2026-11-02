<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { useDiagnosticsSettings } from '@/app/diagnostics/settings'
import { useUsageSettings } from '@/app/usage/settings/use'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { diagnostics: diagnosticMessages, settings } = useI18n()

function formatTokenValue(value: number | null): string {
  return value === null ? diagnosticMessages.value.usageNotReported : value.toLocaleString()
}

const { summary } = useUsageSettings()
const { usageEnabled } = useDiagnosticsSettings()

const totals = computed(() => {
  const messages = diagnosticMessages.value
  const current = summary.value
  return [
    { label: messages.usageRequests, value: current.requests.toLocaleString() },
    { label: messages.usageCompleted, value: current.completedRequests.toLocaleString() },
    { label: messages.usageInputTokens, value: formatTokenValue(current.inputTokens) },
    { label: messages.usageOutputTokens, value: formatTokenValue(current.outputTokens) },
    { label: messages.usageCachedInputTokens, value: formatTokenValue(current.cacheReadTokens) },
    { label: messages.usageCacheWriteTokens, value: formatTokenValue(current.cacheWriteTokens) }
  ]
})
</script>

<template>
  <SettingsSection data-test-id="settings-usage-panel">
    <template #title>{{ settings.usage }}</template>
    <template #description>{{ diagnosticMessages.usageDescription }}</template>

    <SettingsGroup>
      <SettingsRow
        as="label"
        :label="diagnosticMessages.usageHistory"
        :description="diagnosticMessages.usageHistoryDescription"
        :modified="!usageEnabled"
        @reset="usageEnabled = true"
      >
        <AppSwitch v-model="usageEnabled" :label="diagnosticMessages.usageHistory" />
      </SettingsRow>
    </SettingsGroup>

    <div class="grid grid-cols-2 gap-2">
      <div v-for="total in totals" :key="total.label" class="rounded border border-border p-3">
        <div class="text-[11px] text-muted">{{ total.label }}</div>
        <div class="mt-1 text-sm font-semibold text-surface">{{ total.value }}</div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <h4 class="text-xs font-semibold text-surface">{{ diagnosticMessages.usageByModel }}</h4>
      <div v-if="summary.models.length === 0" class="text-[11px] text-muted">
        {{ diagnosticMessages.usageNoData }}
      </div>
      <div
        v-for="model in summary.models"
        :key="`${model.provider}-${model.model}`"
        class="flex justify-between gap-3 text-[11px]"
      >
        <span class="min-w-0 truncate text-muted">{{ model.provider }} · {{ model.model }}</span>
        <span class="shrink-0 text-surface tabular-nums">
          {{
            diagnosticMessages.modelStepTokens({
              input: formatTokenValue(model.inputTokens),
              output: formatTokenValue(model.outputTokens)
            })
          }}
        </span>
      </div>
    </div>

    <p class="text-[11px] text-muted">{{ diagnosticMessages.usageCacheNote }}</p>
  </SettingsSection>
</template>
