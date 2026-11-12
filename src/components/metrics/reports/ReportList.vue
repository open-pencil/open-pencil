<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import IconBug from '~icons/lucide/bug'
import IconMessageSquare from '~icons/lucide/message-square'

import {
  REPORT_INBOX_FILTERS,
  type InboxReport,
  type ReportInboxFilter
} from '@open-pencil/feedback/contract'

import { useDateFormat } from '@/app/i18n/date'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { metricsInboxTheme } from '@/theme/metrics/dashboard'

import { REPORT_STATUS_LABELS } from './labels'

const metricsInbox = tv(metricsInboxTheme)

/**
 * The reports to work through, newest first: each by what its sender wrote, who sent it, when, and
 * where the team stands. The filter and search ask the server; scrolling to the end loads more,
 * and the arrow keys move the selection.
 */
const {
  reports,
  selectedId = null,
  counts = null,
  hasMore = false,
  loadingMore = false
} = defineProps<{
  reports: InboxReport[]
  selectedId?: string | null
  counts?: Record<ReportInboxFilter, number> | null
  hasMore?: boolean
  loadingMore?: boolean
}>()
const filter = defineModel<ReportInboxFilter>('filter', { required: true })
const query = defineModel<string>('query', { required: true })
const emit = defineEmits<{
  select: [report: InboxReport]
  /** The first report, chosen for the person when nothing is chosen yet. */
  preselect: [report: InboxReport]
  /** The list reached its end with more to load. */
  more: []
}>()

const ui = metricsInbox()
const dates = useDateFormat()

const filters = REPORT_INBOX_FILTERS.map((value) => ({
  value,
  label: value === 'all' ? 'All' : REPORT_STATUS_LABELS[value].label
}))
const filterValue = computed({
  get: () => filter.value,
  set: (value: string) => {
    const option = filters.find((each) => each.value === value)
    if (option) filter.value = option.value
  }
})
const countOf = (value: string) => {
  const option = filters.find((each) => each.value === value)
  return option && counts ? counts[option.value] : null
}

const list = useTemplateRef<HTMLElement>('list')
const end = useTemplateRef<HTMLElement>('end')
useIntersectionObserver(end, ([entry]) => {
  if (entry?.isIntersecting && hasMore && !loadingMore) emit('more')
})

function choose(report: InboxReport) {
  emit('select', report)
  void nextTick(() => {
    list.value?.querySelector(`[data-id="${report.id}"]`)?.scrollIntoView({ block: 'nearest' })
  })
}
/** Up and down move to the report before or after the one chosen. */
function move(step: number) {
  const index = reports.findIndex((report) => report.id === selectedId)
  const next = reports[Math.min(Math.max(index + step, 0), reports.length - 1)]
  if (next) choose(next)
}
// The first report opens on its own while nothing is chosen, so the report pane never starts
// empty; one chosen before keeps showing while another filter is looked through.
watch(
  () => reports,
  (rows) => {
    const first = rows[0]
    if (first && selectedId === null) emit('preselect', first)
  },
  { immediate: true }
)
</script>

<template>
  <div :class="ui.toolbar()">
    <SegmentedControl
      v-model="filterValue"
      label="Status"
      :options="filters"
      size="md"
      :ui="{ root: 'self-start' }"
    >
      <template #option="{ option }">
        {{ option.label }}
        <span v-if="countOf(option.value) !== null" class="text-muted tabular-nums">
          {{ countOf(option.value) }}
        </span>
      </template>
    </SegmentedControl>
    <AppInput
      v-model="query"
      type="search"
      placeholder="Search notes, addresses, errors, versions"
      aria-label="Search reports"
    >
      <template #leading><icon-lucide-search class="size-3.5" /></template>
    </AppInput>
  </div>
  <div
    v-if="reports.length"
    ref="list"
    role="listbox"
    aria-label="Reports"
    tabindex="0"
    :aria-activedescendant="selectedId ? `report-${selectedId}` : undefined"
    :class="ui.list()"
    @keydown.down.prevent="move(1)"
    @keydown.up.prevent="move(-1)"
  >
    <button
      v-for="report in reports"
      :id="`report-${report.id}`"
      :key="report.id"
      type="button"
      role="option"
      tabindex="-1"
      :data-id="report.id"
      :aria-selected="report.id === selectedId"
      :data-selected="report.id === selectedId"
      :class="ui.item()"
      @click="choose(report)"
    >
      <component
        :is="report.kind === 'error' ? IconBug : IconMessageSquare"
        :class="ui.itemIcon()"
      />
      <span :class="ui.itemBody()">
        <span :class="ui.itemTitle()">{{ report.note ?? report.error ?? 'No note' }}</span>
        <span :class="ui.itemMeta()">
          <span :class="ui.itemSender()">{{ report.email ?? 'No address' }}</span>
          <span aria-hidden="true">·</span>
          <span class="shrink-0">{{ dates.relative(report.receivedAt) }}</span>
          <span :class="ui.statusDot()" :data-status="report.status" />
          <span class="sr-only">{{ REPORT_STATUS_LABELS[report.status].label }}</span>
        </span>
      </span>
    </button>
    <div ref="end" class="flex flex-col gap-2 p-3">
      <template v-if="loadingMore">
        <span class="sr-only">Loading more reports…</span>
        <AppSkeleton v-for="row in 2" :key="row" class="h-10 w-full" />
      </template>
    </div>
  </div>
  <div v-else :class="ui.listEmpty()">
    <AppPlaceholder
      size="compact"
      :fill="false"
      label="No reports"
      :description="query ? 'Nothing matches the search.' : 'Nothing here yet.'"
    >
      <template #icon><icon-lucide-inbox class="size-5" /></template>
    </AppPlaceholder>
  </div>
</template>
