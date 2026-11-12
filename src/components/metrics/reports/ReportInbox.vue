<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { ref } from 'vue'

import type {
  InboxReport,
  ReportDetail,
  ReportInboxFilter,
  ReportStatus
} from '@open-pencil/feedback/contract'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import { metricsInboxTheme } from '@/theme/metrics/dashboard'

import ReportList from './ReportList.vue'
import ReportView from './ReportView.vue'

const metricsInbox = tv(metricsInboxTheme)

/**
 * The report inbox like a mail client: the reports on the left, the one chosen on the right,
 * triaged where it is read. On a narrow page the list and the report take turns.
 */
const {
  reports,
  counts = null,
  hasMore = false,
  loadingMore = false,
  selected = null,
  detail = null,
  detailFailed = false,
  saveFailed = false
} = defineProps<{
  reports: InboxReport[]
  counts?: Record<ReportInboxFilter, number> | null
  hasMore?: boolean
  loadingMore?: boolean
  selected?: InboxReport | null
  detail?: ReportDetail | null
  detailFailed?: boolean
  saveFailed?: boolean
}>()
const filter = defineModel<ReportInboxFilter>('filter', { required: true })
const query = defineModel<string>('query', { required: true })
const emit = defineEmits<{
  select: [report: InboxReport]
  more: []
  status: [report: InboxReport, status: ReportStatus]
  note: [report: InboxReport, note: string | null]
  preview: [url: string]
}>()

const ui = metricsInbox()
/** On a narrow page, whether the report shows instead of the list. */
const reading = ref(false)

function choose(report: InboxReport) {
  reading.value = true
  emit('select', report)
}
</script>

<template>
  <div :class="ui.root()">
    <div :class="ui.listPane()" :data-hidden="reading">
      <ReportList
        v-model:filter="filter"
        v-model:query="query"
        :reports="reports"
        :counts="counts"
        :has-more="hasMore"
        :loading-more="loadingMore"
        :selected-id="selected?.id ?? null"
        @select="choose"
        @preselect="(report) => emit('select', report)"
        @more="emit('more')"
      />
    </div>
    <div :class="ui.detailPane()" :data-hidden="!reading">
      <template v-if="selected">
        <AppButton
          size="sm"
          variant="ghost"
          class="m-2 self-start md:hidden"
          @click="reading = false"
        >
          <template #leading>
            <icon-lucide-arrow-left class="size-3.5" data-direction="reading" />
          </template>
          Reports
        </AppButton>
        <ReportView
          :report="selected"
          :detail="detail"
          :detail-failed="detailFailed"
          :save-failed="saveFailed"
          @status="(status) => emit('status', selected, status)"
          @note="(note) => emit('note', selected, note)"
          @preview="(url) => emit('preview', url)"
        />
      </template>
      <div v-else class="flex flex-1 items-center justify-center">
        <AppPlaceholder size="compact" :fill="false" label="Choose a report">
          <template #icon><icon-lucide-inbox class="size-5" /></template>
        </AppPlaceholder>
      </div>
    </div>
  </div>
</template>
