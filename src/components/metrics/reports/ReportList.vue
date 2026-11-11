<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import IconBug from '~icons/lucide/bug'
import IconMessageSquare from '~icons/lucide/message-square'

import type { InboxReport } from '@open-pencil/feedback/contract'

import { useDateFormat } from '@/app/i18n/date'
import { reportInboxPage, type ReportInboxFilter } from '@/app/metrics/reports'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { metricsInboxTheme } from '@/theme/metrics/dashboard'

import { REPORT_STATUS_LABELS } from './labels'

const metricsInbox = tv(metricsInboxTheme)

/**
 * The reports to work through, newest first: each by what its sender wrote, who sent it, when, and
 * where the team stands. Filters and search narrow it; the arrow keys move the selection.
 */
const { reports, selectedId = null } = defineProps<{
  reports: InboxReport[]
  selectedId?: string | null
}>()
const emit = defineEmits<{
  select: [report: InboxReport]
  /** The first report, chosen for the person when nothing shown is. */
  preselect: [report: InboxReport]
}>()

const ui = metricsInbox()
const dates = useDateFormat()
const filter = ref<ReportInboxFilter>('open')
const query = ref('')

const page = computed(() =>
  reportInboxPage(reports, {
    filter: filter.value,
    search: query.value,
    offset: 0,
    limit: Math.max(reports.length, 1)
  })
)
const shown = computed(() => page.value.rows)
const filters = computed(() =>
  (['open', 'replied', 'closed', 'all'] as const).map((value) => ({
    value,
    label: value === 'all' ? 'All' : REPORT_STATUS_LABELS[value].label
  }))
)
const filterValue = computed({
  get: () => filter.value,
  set: (value: string) => {
    const option = filters.value.find((each) => each.value === value)
    if (option) filter.value = option.value
  }
})

const countOf = (value: string) => {
  const option = filters.value.find((each) => each.value === value)
  return option ? page.value.counts[option.value] : null
}

const list = useTemplateRef<HTMLElement>('list')
function choose(report: InboxReport) {
  emit('select', report)
  void nextTick(() => {
    list.value?.querySelector(`[data-id="${report.id}"]`)?.scrollIntoView({ block: 'nearest' })
  })
}
/** Up and down move to the report before or after the one chosen. */
function move(step: number) {
  const index = shown.value.findIndex((report) => report.id === selectedId)
  const next = shown.value[Math.min(Math.max(index + step, 0), shown.value.length - 1)]
  if (next) choose(next)
}
// The first report of what is shown opens on its own, so the right pane never starts empty.
watch(
  shown,
  (rows) => {
    const first = rows[0]
    if (first && !rows.some((report) => report.id === selectedId)) emit('preselect', first)
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
        <span class="text-muted tabular-nums">{{ countOf(option.value) }}</span>
      </template>
    </SegmentedControl>
    <AppInput
      v-model="query"
      type="search"
      placeholder="Search reports"
      aria-label="Search reports"
    >
      <template #leading><icon-lucide-search class="size-3.5" /></template>
    </AppInput>
  </div>
  <div
    v-if="shown.length"
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
      v-for="report in shown"
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
  </div>
  <div v-else :class="ui.listEmpty()">
    <AppPlaceholder
      size="compact"
      :fill="false"
      label="No reports"
      :description="query ? 'Nothing matches the search.' : 'Nothing here in this range.'"
    >
      <template #icon><icon-lucide-inbox class="size-5" /></template>
    </AppPlaceholder>
  </div>
</template>
