<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { ref } from 'vue'

import type {
  InboxReport,
  ReportDetail,
  ReportInboxFilter,
  ReportStatus
} from '@open-pencil/feedback/contract'

import type { ReportSaveState } from '@/app/metrics/reports'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import { metricsInboxTheme } from '@/theme/metrics/dashboard'

import { replyLink } from './labels'
import ReportList from './ReportList.vue'
import ReportView from './ReportView.vue'

const metricsInbox = tv(metricsInboxTheme)

/**
 * The report inbox like a mail client: the reports on the left, the one chosen on the right,
 * triaged where it is read. On a narrow page the list and the report take turns. Keys work the
 * queue while nothing is being typed: J and K move, E closes and moves on, R replies.
 */
const {
  reports,
  counts = null,
  hasMore = false,
  loadingMore = false,
  selected = null,
  detail = null,
  detailFailed = false,
  saveState = 'idle'
} = defineProps<{
  reports: InboxReport[]
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
}>()

const ui = metricsInbox()
/** On a narrow page, whether the report shows instead of the list. */
const reading = ref(false)

function choose(report: InboxReport) {
  reading.value = true
  emit('select', report)
}

/** The report a step away from the one open, if there is one. */
function neighbour(step: number): InboxReport | undefined {
  const index = reports.findIndex((report) => report.id === selected?.id)
  return index === -1 ? undefined : reports[index + step]
}
function move(step: number) {
  const next = neighbour(step)
  if (next) choose(next)
}
/** Closes the report open and opens the next, or the one before at the end of the list. */
function closeAndMoveOn() {
  if (!selected) return
  const next = neighbour(1) ?? neighbour(-1)
  if (selected.status !== 'closed') emit('status', selected, 'closed')
  if (next) choose(next)
}
function reply() {
  if (selected?.email) globalThis.location.assign(replyLink(selected))
}

/** A key that types into a field, or into an open menu or dialog, is not a shortcut. */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest('input, textarea, select, [role="listbox"], [role="menu"], [role="dialog"]') !==
      null)
function shortcut(key: string, run: () => void) {
  onKeyStroke(
    key,
    (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return
      event.preventDefault()
      run()
    },
    { dedupe: true }
  )
}
const SHORTCUT_HINTS = [
  { keys: ['J', 'K'], label: 'move' },
  { keys: ['E'], label: 'close' },
  { keys: ['R'], label: 'reply' }
]
shortcut('j', () => move(1))
shortcut('k', () => move(-1))
shortcut('e', closeAndMoveOn)
shortcut('r', reply)
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
      <p :class="ui.shortcuts()" aria-hidden="true">
        <span v-for="hint in SHORTCUT_HINTS" :key="hint.label" :class="ui.shortcut()">
          <kbd v-for="key in hint.keys" :key="key" :class="ui.key()">{{ key }}</kbd>
          {{ hint.label }}
        </span>
      </p>
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
          :save-state="saveState"
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
