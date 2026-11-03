<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { diagnostics } from '@/app/diagnostics'
import { diagnosticsEnvironment } from '@/app/diagnostics/environment'
import { saveDiagnosticsReport } from '@/app/diagnostics/save'
import {
  DIAGNOSTICS_RETENTION_DEFAULT,
  DIAGNOSTICS_RETENTION_MAX,
  DIAGNOSTICS_RETENTION_MIN,
  diagnosticsRetentionPresets,
  useDiagnosticsSettings
} from '@/app/diagnostics/settings'
import { toast } from '@/app/shell/ui'
import DiagnosticsEventList from '@/components/settings/diagnostics/DiagnosticsEventList.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import PresetNumberField from '@/components/ui/input/PresetNumberField.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { common, diagnostics: diagnosticMessages } = useI18n()
const clearOpen = ref(false)

const { diagnosticsEnabled, diagnosticsRetention } = useDiagnosticsSettings()
const diagnosticsCount = ref(0)
const diagnosticsSize = ref(0)

async function refreshDiagnosticsStats(): Promise<void> {
  const events = await diagnostics.list()
  diagnosticsCount.value = events.length
  diagnosticsSize.value = JSON.stringify(events).length
}

const retentionValue = computed({
  get: () => diagnosticsRetention.value,
  set: (value) => {
    diagnosticsRetention.value = value
  }
})

/** Retention is a stored policy change, so pruning follows the committed value. */
async function commitRetention(value: number): Promise<void> {
  await diagnostics.prune(value)
  await refreshDiagnosticsStats()
}

async function resetRetention(): Promise<void> {
  retentionValue.value = DIAGNOSTICS_RETENTION_DEFAULT
  await commitRetention(DIAGNOSTICS_RETENTION_DEFAULT)
}

async function clearDiagnostics() {
  await diagnostics.clear()
  await refreshDiagnosticsStats()
  clearOpen.value = false
  toast.info(diagnosticMessages.value.cleared)
}

/** The report, read when it is copied so it has every event so far. */
function diagnosticsReport(): Promise<string> {
  return diagnostics.export(diagnosticsEnvironment())
}

async function saveDiagnostics() {
  try {
    await saveDiagnosticsReport()
  } catch {
    toast.error(diagnosticMessages.value.saveFailed)
  }
}
</script>

<template>
  <SettingsSection data-test-id="settings-diagnostics-panel">
    <template #title>{{ diagnosticMessages.title }}</template>
    <template #description>{{ diagnosticMessages.description }}</template>
    <SettingsGroup>
      <SettingsRow
        as="label"
        :label="diagnosticMessages.localDiagnostics"
        :description="diagnosticMessages.localDiagnosticsDescription"
        :modified="!diagnosticsEnabled"
        @reset="diagnosticsEnabled = true"
      >
        <AppSwitch v-model="diagnosticsEnabled" :label="diagnosticMessages.localDiagnostics" />
      </SettingsRow>
      <SettingsRow
        :label="diagnosticMessages.retention"
        :description="diagnosticMessages.retentionDescription"
        class="max-sm:flex-col max-sm:items-stretch"
        :modified="retentionValue !== DIAGNOSTICS_RETENTION_DEFAULT"
        @reset="resetRetention"
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
    <DiagnosticsEventList :refresh-stats="refreshDiagnosticsStats" />
    <!-- On a narrow page the buttons wrap below the count rather than squeezing it. -->
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-2xs text-muted">
      <span class="whitespace-nowrap">{{
        diagnosticMessages.eventCount({
          count: diagnosticsCount,
          size: Math.ceil(diagnosticsSize / 1024)
        })
      }}</span>
      <div class="flex flex-wrap items-center gap-1.5">
        <AppCopyButton
          :value="diagnosticsReport"
          :label="diagnosticMessages.copy"
          :copied-label="common.copied"
          size="xs"
          color="neutral"
          variant="ghost"
          @failed="toast.error(diagnosticMessages.copyFailed)"
        />
        <AppButton size="xs" color="neutral" variant="ghost" @click="saveDiagnostics"
          ><template #leading><icon-lucide-download /></template
          >{{ diagnosticMessages.save }}</AppButton
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
