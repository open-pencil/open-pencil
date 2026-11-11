<script setup lang="ts">
import { computed, ref } from 'vue'

import type { MetricsSnapshot } from '@open-pencil/feedback/contract'

import { usePortalTheme } from '@/app/cloud-portal/theme'
import { useMetricsSnapshot } from '@/app/metrics/load'
import type { MetricsRange } from '@/app/metrics/range'
import { useReportInbox, useReportTriage } from '@/app/metrics/reports'
import MetricsDashboard from '@/components/metrics/MetricsDashboard.vue'
import ReportInboxPanel from '@/components/metrics/reports/ReportInboxPanel.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'

// Served from the feedback Worker's own address, so it follows the system theme as Cloud's
// pages do; the editor's stored theme is not visible here.
usePortalTheme()

/** The page mounts once its first numbers have loaded, or failed to, so it never shows half. */
const { initialRange, initialSnapshot } = defineProps<{
  initialRange: MetricsRange
  initialSnapshot?: MetricsSnapshot
}>()

const range = ref(initialRange)
const { snapshot, loading, failed, refresh } = useMetricsSnapshot(range, initialSnapshot)
const tab = ref<'metrics' | 'reports'>('metrics')

// The inbox loads with the page, so its tab can show how many reports are open.
const inbox = useReportInbox(range)
void inbox.refresh()
const {
  reports,
  truncated,
  loading: inboxLoading,
  loaded: inboxLoaded,
  failed: inboxFailed
} = inbox
const openReports = computed(() =>
  inboxLoaded.value ? reports.value.filter((report) => report.status === 'open').length : undefined
)
const triage = useReportTriage(inbox)
const { selected, detail, detailFailed, saving, busy } = triage
const dialogOpen = ref(false)
const saveFailed = ref(false)
const triageFailed = ref(false)

/** Counts the dialog's openings, so a save that finishes late never closes a later one. */
let openings = 0

function openReport(report: Parameters<typeof triage.open>[0]) {
  openings++
  saveFailed.value = false
  dialogOpen.value = true
  void triage.open(report)
}
async function saveReport(changes: Parameters<typeof triage.save>[0]) {
  const opening = openings
  const saved = await triage.save(changes)
  if (opening !== openings || !dialogOpen.value) return
  saveFailed.value = !saved
  if (saved) dialogOpen.value = false
}
async function setReportStatus(...args: Parameters<typeof triage.setStatus>) {
  triageFailed.value = !(await triage.setStatus(...args))
}
const inboxPanel = computed(() => ({
  reports: reports.value,
  truncated: truncated.value,
  loadFailed: inboxFailed.value,
  statusFailed: triageFailed.value,
  busy: busy.value,
  selected: selected.value,
  detail: detail.value,
  detailFailed: detailFailed.value,
  saving: saving.value,
  saveFailed: saveFailed.value
}))
const inboxPanelEvents = {
  open: openReport,
  triage: setReportStatus,
  save: saveReport,
  reload: () => reload()
}
const refreshTab = () => (tab.value === 'reports' ? inbox.refresh() : refresh())
const host = globalThis.location.host
// Access's session may have run out; reloading the page signs in again.
const reload = () => globalThis.location.reload()
</script>

<template>
  <MetricsDashboard
    v-if="snapshot"
    v-model:range="range"
    v-model:tab="tab"
    :host="host"
    :snapshot="snapshot"
    :loading="tab === 'reports' ? inboxLoading : loading"
    :open-reports="openReports"
    @refresh="refreshTab"
  >
    <template #reports>
      <ReportInboxPanel
        v-bind="inboxPanel"
        v-model:dialog-open="dialogOpen"
        v-on="inboxPanelEvents"
      />
    </template>
    <template v-if="failed" #alert>
      <AppAlert
        tone="warning"
        heading="These numbers could not be updated"
        description="Your sign-in may have expired. Reload the page to sign in again."
      >
        <template #actions>
          <AppButton size="sm" variant="outline" @click="reload">Reload</AppButton>
        </template>
      </AppAlert>
    </template>
  </MetricsDashboard>
  <!-- The inbox loads on its own, so it stays reachable while the metrics are down. -->
  <main
    v-else-if="failed && tab === 'reports'"
    class="h-full overflow-y-auto bg-canvas text-surface"
  >
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-6">
      <div>
        <AppButton size="sm" variant="ghost" @click="tab = 'metrics'">
          <icon-lucide-arrow-left class="size-3.5" data-direction="reading" />
          Metrics
        </AppButton>
      </div>
      <ReportInboxPanel
        v-bind="inboxPanel"
        v-model:dialog-open="dialogOpen"
        v-on="inboxPanelEvents"
      />
    </div>
  </main>
  <main v-else-if="failed" class="flex h-full bg-canvas text-surface">
    <AppPlaceholder
      size="page"
      label-as="h1"
      label="The metrics could not load"
      description="Your sign-in may have expired, or the service did not answer. Reload the page to try again."
    >
      <template #icon><icon-lucide-cloud-off class="size-5" /></template>
      <template #action>
        <AppButton variant="outline" @click="reload">Reload</AppButton>
        <AppButton variant="outline" @click="tab = 'reports'">Open reports</AppButton>
      </template>
    </AppPlaceholder>
  </main>
</template>
