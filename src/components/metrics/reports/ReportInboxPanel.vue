<script setup lang="ts">
import type { InboxReport, ReportDetail, ReportStatus } from '@open-pencil/feedback/contract'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'

import ReportInbox from './ReportInbox.vue'

/**
 * The report inbox with its notices: on the dashboard's Reports tab, and on its own when the
 * metrics could not load. Until the first load finishes it is not known to be empty.
 */
const {
  reports,
  loaded = false,
  truncated = false,
  loadFailed = false,
  selected = null,
  detail = null,
  detailFailed = false,
  saveFailed = false
} = defineProps<{
  reports: InboxReport[]
  /** The selected range's reports have loaded. */
  loaded?: boolean
  truncated?: boolean
  loadFailed?: boolean
  selected?: InboxReport | null
  detail?: ReportDetail | null
  detailFailed?: boolean
  /** The last status or note change did not save. */
  saveFailed?: boolean
}>()
const emit = defineEmits<{
  select: [report: InboxReport]
  status: [report: InboxReport, status: ReportStatus]
  note: [report: InboxReport, note: string | null]
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
    :selected="selected"
    :detail="detail"
    :detail-failed="detailFailed"
    :save-failed="saveFailed"
    @select="(report) => emit('select', report)"
    @status="(report, status) => emit('status', report, status)"
    @note="(report, note) => emit('note', report, note)"
  />
</template>
