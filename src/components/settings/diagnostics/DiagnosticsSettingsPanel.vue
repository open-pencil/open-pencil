<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { diagnostics } from '@/app/diagnostics'
import { diagnosticsEnvironment } from '@/app/diagnostics/environment'
import { saveDiagnosticsReport } from '@/app/diagnostics/save'
import {
  DIAGNOSTICS_RETENTION_MAX,
  DIAGNOSTICS_RETENTION_MIN,
  diagnosticsRetentionPresets,
  pruneDiagnostics,
  useDiagnosticsSettings
} from '@/app/diagnostics/settings'
import { toast } from '@/app/shell/ui'
import DiagnosticsEventList from '@/components/settings/diagnostics/DiagnosticsEventList.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import PresetNumberField from '@/components/ui/input/PresetNumberField.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { common, diagnostics: diagnosticMessages } = useI18n()
const { copy: copyText, copied } = useClipboard({ copiedDuring: 1500 })
const clearOpen = ref(false)

const {
  diagnosticsEnabled,
  diagnosticsCount,
  diagnosticsSize,
  diagnosticsRetention,
  refreshDiagnosticsStats
} = useDiagnosticsSettings()

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
  try {
    await copyText(await diagnostics.export(diagnosticsEnvironment()))
  } catch {
    toast.error(diagnosticMessages.value.copyFailed)
  }
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
      >
        <AppSwitch v-model="diagnosticsEnabled" :label="diagnosticMessages.localDiagnostics" />
      </SettingsRow>
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
    <DiagnosticsEventList :refresh-stats="refreshDiagnosticsStats" />
    <!-- On a narrow page the buttons wrap below the count rather than squeezing it. -->
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted">
      <span class="whitespace-nowrap">{{
        diagnosticMessages.eventCount({
          count: diagnosticsCount,
          size: Math.ceil(diagnosticsSize / 1024)
        })
      }}</span>
      <div class="flex flex-wrap items-center gap-1.5">
        <AppButton size="xs" color="neutral" variant="ghost" @click="exportDiagnostics"
          ><template #leading
            ><icon-lucide-check v-if="copied" /><icon-lucide-copy v-else /></template
          >{{ copied ? common.copied : diagnosticMessages.copy }}</AppButton
        >
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
