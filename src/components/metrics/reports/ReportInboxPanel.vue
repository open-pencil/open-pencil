<script setup lang="ts">
import type {
  InboxReport,
  ReportDetail,
  ReportInboxFilter,
  ReportStatus
} from '@open-pencil/feedback/contract'

import type { ReportSaveState } from '@/app/metrics/reports'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'

import ReportInbox from './ReportInbox.vue'

/**
 * The report inbox with its notices: on the dashboard's Reports tab, and on its own when the
 * metrics could not load. Until the first page arrives it is not known to be empty.
 */
const {
  reports,
  loaded = false,
  loadFailed = false,
  counts = null,
  hasMore = false,
  loadingMore = false,
  selected = null,
  detail = null,
  detailFailed = false,
  saveState = 'idle'
} = defineProps<{
  reports: InboxReport[]
  loaded?: boolean
  loadFailed?: boolean
  counts?: Record<ReportInboxFilter, number> | null
  hasMore?: boolean
  loadingMore?: boolean
  selected?: InboxReport | null
  detail?: ReportDetail | null
  detailFailed?: boolean
  /** Where the last status or note change on the report open stands. */
  saveState?: ReportSaveState
}>()
const filter = defineModel<ReportInboxFilter>('filter', { required: true })
const query = defineModel<string>('query', { required: true })
const emit = defineEmits<{
  select: [report: InboxReport]
  more: []
  status: [report: InboxReport, status: ReportStatus]
  note: [report: InboxReport, note: string | null]
  preview: [url: string]
  reload: []
}>()
</script>

<template>
  <AppAlert
    v-if="loadFailed"
    tone="warning"
    heading="The reports could not load"
    description="Your sign-in may have expired. Reload the page to sign in again."
  >
    <template #actions>
      <AppButton size="sm" variant="outline" @click="emit('reload')">Reload</AppButton>
    </template>
  </AppAlert>
  <div v-if="!loaded && !loadFailed" class="flex flex-col gap-2" aria-busy="true">
    <span class="sr-only">Loading reports…</span>
    <AppSkeleton v-for="row in 4" :key="row" class="h-12 w-full" />
  </div>
  <ReportInbox
    v-else-if="loaded"
    v-model:filter="filter"
    v-model:query="query"
    :reports="reports"
    :counts="counts"
    :has-more="hasMore"
    :loading-more="loadingMore"
    :selected="selected"
    :detail="detail"
    :detail-failed="detailFailed"
    :save-state="saveState"
    @select="(report) => emit('select', report)"
    @more="emit('more')"
    @status="(report, status) => emit('status', report, status)"
    @note="(report, note) => emit('note', report, note)"
    @preview="(url) => emit('preview', url)"
  />
</template>
