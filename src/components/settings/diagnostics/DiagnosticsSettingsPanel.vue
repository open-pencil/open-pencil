<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { diagnostics, summarizeDiagnosticEvent } from '@/app/diagnostics'
import {
  DIAGNOSTICS_RETENTION_MAX,
  DIAGNOSTICS_RETENTION_MIN,
  diagnosticsRetentionPresets,
  pruneDiagnostics,
  useDiagnosticsSettings
} from '@/app/diagnostics/settings'
import { useRecentDiagnostics } from '@/app/diagnostics/settings/recent'
import { toast } from '@/app/shell/ui'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import PresetNumberField from '@/components/ui/input/PresetNumberField.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { common, diagnostics: diagnosticMessages } = useI18n()
const clearOpen = ref(false)

const {
  diagnosticsEnabled,
  usageEnabled,
  diagnosticsCount,
  diagnosticsSize,
  diagnosticsRetention,
  refreshDiagnosticsStats
} = useDiagnosticsSettings()
const { recentEvents } = useRecentDiagnostics(
  (events) => events.map((event) => summarizeDiagnosticEvent(event, diagnosticMessages.value)),
  refreshDiagnosticsStats
)

const retentionValue = computed({
  get: () => diagnosticsRetention.value,
  set: (value) => {
    diagnosticsRetention.value = value
  }
})

/** Retention is a stored policy change, so pruning follows the committed value. */
async function commitRetention(value: number): Promise<void> {
  await pruneDiagnostics(value)
  await refreshDiagnosticsStats()
}

async function clearDiagnostics() {
  await diagnostics.clear()
  await refreshDiagnosticsStats()
  clearOpen.value = false
  toast.info(diagnosticMessages.value.cleared)
}

async function exportDiagnostics() {
  const text = await diagnostics.export()
  try {
    await navigator.clipboard.writeText(text)
    toast.info(diagnosticMessages.value.copied)
  } catch {
    toast.error(diagnosticMessages.value.copyFailed)
  }
}
</script>

<template>
  <SettingsSection data-test-id="settings-diagnostics-panel">
    <template #title>{{ diagnosticMessages.title }}</template>
    <template #description>{{ diagnosticMessages.description }}</template>
    <SettingsGroup>
      <label class="flex items-center justify-between gap-4 px-3 py-2.5">
        <span
          ><span class="block text-xs text-surface">{{ diagnosticMessages.localDiagnostics }}</span
          ><span class="block text-[10px] text-muted">{{
            diagnosticMessages.localDiagnosticsDescription
          }}</span></span
        >
        <AppSwitch v-model="diagnosticsEnabled" :label="diagnosticMessages.localDiagnostics" />
      </label>
      <label class="flex items-center justify-between gap-4 px-3 py-2.5">
        <span
          ><span class="block text-xs text-surface">{{ diagnosticMessages.usageHistory }}</span
          ><span v-if="usageEnabled" class="block text-[10px] text-muted">{{
            diagnosticMessages.usageHistoryDescription
          }}</span></span
        >
        <AppSwitch v-model="usageEnabled" :label="diagnosticMessages.usageHistory" />
      </label>
      <SettingsRow
        :label="diagnosticMessages.retention"
        :description="diagnosticMessages.retentionDescription"
        class="max-sm:flex-col max-sm:items-stretch"
      >
        <PresetNumberField
          v-model:number="retentionValue"
          :presets="diagnosticsRetentionPresets"
          :min="DIAGNOSTICS_RETENTION_MIN"
          :max="DIAGNOSTICS_RETENTION_MAX"
          :label="diagnosticMessages.retention"
          :custom-label="diagnosticMessages.retentionCustom"
          :range-message="
            diagnosticMessages.retentionRange({
              min: DIAGNOSTICS_RETENTION_MIN,
              max: DIAGNOSTICS_RETENTION_MAX
            })
          "
          @commit="commitRetention"
        />
      </SettingsRow>
    </SettingsGroup>
    <SettingsGroup v-if="recentEvents.length">
      <div
        v-for="event in recentEvents"
        :key="`${event.timestamp}-${event.label}`"
        class="flex items-center justify-between gap-3 px-3 py-2 text-[11px]"
      >
        <span class="flex min-w-0 items-center gap-2">
          <icon-lucide-circle-alert
            v-if="event.level === 'error'"
            class="size-3.5 shrink-0 text-error"
          />
          <icon-lucide-info v-else class="size-3.5 shrink-0 text-muted" />
          <span class="truncate text-surface">{{ event.label }}</span>
        </span>
        <span class="shrink-0 text-muted">{{
          new Date(event.timestamp).toLocaleTimeString()
        }}</span>
      </div>
    </SettingsGroup>
    <div class="flex items-center justify-between text-[11px] text-muted">
      <span>{{
        diagnosticMessages.eventCount({
          count: diagnosticsCount,
          size: Math.ceil(diagnosticsSize / 1024)
        })
      }}</span>
      <div class="flex items-center gap-1.5">
        <AppButton size="xs" color="neutral" variant="ghost" @click="exportDiagnostics"
          ><template #leading><icon-lucide-copy /></template
          >{{ diagnosticMessages.copy }}</AppButton
        >
        <AppButton
          size="xs"
          color="error"
          variant="ghost"
          :disabled="diagnosticsCount === 0"
          @click="clearOpen = true"
          ><template #leading><icon-lucide-trash-2 /></template
          >{{ diagnosticMessages.clear }}</AppButton
        >
      </div>
    </div>
  </SettingsSection>

  <AppConfirmationDialog
    v-model:open="clearOpen"
    :heading="diagnosticMessages.clear"
    :description="diagnosticMessages.clearDescription"
    :cancel-label="common.cancel"
    :confirm-label="diagnosticMessages.clear"
    tone="danger"
    @confirm="clearDiagnostics"
  />
</template>
