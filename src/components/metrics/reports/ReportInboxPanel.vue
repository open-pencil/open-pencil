<script setup lang="ts">
import type {
  InboxReport,
  ReportDetail,
  ReportStatus,
  ReportTriage
} from '@open-pencil/feedback/contract'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'

import ReportDetailDialog from './ReportDetailDialog.vue'
import ReportInbox from './ReportInbox.vue'

/**
 * The report inbox with its notices and the dialog for one report: on the dashboard's Reports
 * tab, and on its own when the metrics could not load.
 */
const {
  reports,
  loaded = false,
  truncated = false,
  loadFailed = false,
  statusFailed = false,
  busy = null,
  selected = null,
  detail = null,
  detailFailed = false,
  saving = false,
  saveFailed = false
} = defineProps<{
  reports: InboxReport[]
  /** The first load has finished; until then the inbox is not known to be empty. */
  loaded?: boolean
  truncated?: boolean
  loadFailed?: boolean
  /** A status set from a row's menu did not save. */
  statusFailed?: boolean
  busy?: string | null
  selected?: InboxReport | null
  detail?: ReportDetail | null
  detailFailed?: boolean
  saving?: boolean
  saveFailed?: boolean
}>()
const dialogOpen = defineModel<boolean>('dialogOpen', { default: false })
const emit = defineEmits<{
  open: [report: InboxReport]
  triage: [report: InboxReport, status: ReportStatus]
  save: [triage: ReportTriage]
  reload: []
}>()
</script>

<template>
  <AppAlert
    v-if="loadFailed || statusFailed"
    tone="warning"
    :heading="loadFailed ? 'The reports could not load' : 'The report could not be saved'"
    description="Your sign-in may have expired. Reload the page to sign in again."
  >
    <template #actions>
      <AppButton size="sm" variant="outline" @click="emit('reload')">Reload</AppButton>
    </template>
  </AppAlert>
  <AppAlert
    v-if="truncated"
    tone="info"
    heading="Only the newest 500 reports in this range are listed"
    description="Choose a shorter range to see the rest."
  />
  <div v-if="!loaded && !loadFailed" class="flex flex-col gap-2" aria-busy="true">
    <span class="sr-only">Loading reports…</span>
    <AppSkeleton v-for="row in 4" :key="row" class="h-12 w-full" />
  </div>
  <ReportInbox
    v-else-if="loaded"
    :reports="reports"
    :busy="busy"
    @open="(report) => emit('open', report)"
    @triage="(report, status) => emit('triage', report, status)"
  />
  <ReportDetailDialog
    v-if="selected"
    v-model:open="dialogOpen"
    :report="selected"
    :detail="detail"
    :detail-failed="detailFailed"
    :saving="saving"
    :error="
      saveFailed
        ? 'The report could not be saved. Your sign-in may have expired; reload the page.'
        : null
    "
    @save="(changes) => emit('save', changes)"
  />
</template>
