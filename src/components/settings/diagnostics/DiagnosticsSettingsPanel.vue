<script setup lang="ts">
import { useI18n, SegmentedControlItem, SegmentedControlRoot } from '@open-pencil/vue'
import { computed, ref } from 'vue'
import { useRecentDiagnostics } from '@/app/diagnostics/settings/recent'

import { diagnostics, summarizeDiagnosticEvent } from '@/app/diagnostics'
import {
  diagnosticsRetentionOptions,
  pruneDiagnostics,
  useDiagnosticsSettings
} from '@/app/diagnostics/settings'
import { toast } from '@/app/shell/ui'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import AppButton from '@/components/ui/AppButton.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'

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

const retentionValue = computed<string>({
  get: () => String(diagnosticsRetention.value),
  set: (value) => {
    const parsed = Number(value)
    if (parsed === 100 || parsed === 500 || parsed === 1000) {
      diagnosticsRetention.value = parsed
      void pruneDiagnostics(parsed)
      void refreshDiagnosticsStats()
    }
  }
})

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
  <section class="flex flex-col gap-4" data-test-id="settings-diagnostics-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ diagnosticMessages.title }}</h3>
      <p class="mt-1 text-[11px] text-muted">{{ diagnosticMessages.description }}</p>
    </div>
    <div class="flex flex-col divide-y divide-border rounded border border-border">
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
      <div class="flex items-center justify-between gap-4 px-3 py-2.5">
        <span
          ><span class="block text-xs text-surface">{{ diagnosticMessages.retention }}</span
          ><span class="block text-[10px] text-muted">{{
            diagnosticMessages.retentionDescription
          }}</span></span
        >
        <SegmentedControlRoot
          v-model="retentionValue"
          required
          class="flex rounded border border-border p-0.5"
          :aria-label="diagnosticMessages.retention"
        >
          <SegmentedControlItem
            v-for="option in diagnosticsRetentionOptions"
            :key="option"
            :value="String(option)"
            class="rounded px-2 py-1 text-[10px] text-muted data-[state=on]:bg-hover data-[state=on]:text-surface"
            >{{ option }}</SegmentedControlItem
          >
        </SegmentedControlRoot>
      </div>
    </div>
    <div
      v-if="recentEvents.length"
      class="flex max-h-64 flex-col overflow-y-auto divide-y divide-border rounded border border-border"
    >
      <div
        v-for="event in recentEvents"
        :key="`${event.timestamp}-${event.label}`"
        class="flex items-center justify-between gap-3 px-3 py-2 text-[11px]"
      >
        <span class="flex min-w-0 items-center gap-2">
          <icon-lucide-circle-alert
            v-if="event.level === 'error'"
            class="size-3.5 shrink-0 text-red-400"
          />
          <icon-lucide-info v-else class="size-3.5 shrink-0 text-muted" />
          <span class="truncate text-surface">{{ event.label }}</span>
        </span>
        <span class="shrink-0 text-muted">{{
          new Date(event.timestamp).toLocaleTimeString()
        }}</span>
      </div>
    </div>
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
  </section>

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
