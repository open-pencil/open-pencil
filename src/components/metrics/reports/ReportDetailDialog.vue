<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'

import {
  REPORT_FILE_RETENTION_DAYS,
  REPORT_TRIAGE_NOTE_MAX_LENGTH,
  type InboxReport,
  type ReportDetail,
  type ReportTriage
} from '@open-pencil/feedback/contract'

import { formatCount, formatTime } from '@/app/metrics/format'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { metricsReportTheme } from '@/theme/metrics/dashboard'

import { REPORT_STATUS_LABELS, replyLink, reportBuild } from './labels'

const metricsReport = tv(metricsReportTheme)

/**
 * One report: what the sender wrote, their build and files, the steps the app recorded before
 * it, and the team's status and note, saved together.
 */
const {
  report,
  detail = null,
  detailFailed = false,
  saving = false,
  error = null
} = defineProps<{
  report: InboxReport
  /** The steps, once they have loaded. */
  detail?: ReportDetail | null
  detailFailed?: boolean
  saving?: boolean
  /** Why the last save failed. */
  error?: string | null
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [triage: ReportTriage] }>()

const ui = metricsReport()
const status = ref<string>(report.status)
const note = ref(report.triageNote ?? '')
/** The fields as last filled from the report, to tell the person's edits from a saved change. */
let filled = { status: report.status as string, note: report.triageNote ?? '' }
function fill() {
  filled = { status: report.status, note: report.triageNote ?? '' }
  status.value = filled.status
  note.value = filled.note
}
const edited = () => status.value !== filled.status || note.value !== filled.note
// Fields start fresh each opening, from the report as saved, even for the one just canceled.
watch(open, (isOpen) => {
  if (isOpen) fill()
})
watch(() => report.id, fill)
// A save from an earlier opening that lands now updates fields the person hasn't touched since.
watch(
  () => [report.status, report.triageNote],
  () => {
    if (!edited()) fill()
  }
)

const STATUS_OPTIONS = Object.entries(REPORT_STATUS_LABELS).map(([value, { label }]) => ({
  value,
  label
}))
const heading = computed(() => (report.kind === 'error' ? 'Error report' : 'Problem report'))

function save() {
  const chosen = STATUS_OPTIONS.find((option) => option.value === status.value)?.value
  if (chosen === 'open' || chosen === 'replied' || chosen === 'closed')
    emit('save', { status: chosen, note: note.value.trim() || null })
}
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    size="lg"
    :heading="heading"
    :description="`Received ${formatTime(report.receivedAt)} · ${reportBuild(report)}`"
    :error="error"
    data-test-id="report-detail"
    @submit="save"
  >
    <div :class="ui.body()">
      <p v-if="report.note" :class="ui.note()">{{ report.note }}</p>
      <p v-if="report.error" :class="ui.error()">{{ report.error }}</p>
      <dl :class="ui.facts()">
        <dt :class="ui.factLabel()">From</dt>
        <dd :class="ui.factValue()">
          <a v-if="report.email" :class="ui.link()" :href="replyLink(report)">{{ report.email }}</a>
          <span v-else>No address left</span>
        </dd>
        <dt :class="ui.factLabel()">Report ID</dt>
        <dd :class="[ui.factValue(), ui.reportId()]">{{ report.id }}</dd>
        <dt :class="ui.factLabel()">Links</dt>
        <dd :class="[ui.factValue(), ui.links()]">
          <a :class="ui.link()" :href="report.eventURL" target="_blank" rel="noopener">
            Event in PostHog
          </a>
          <template v-for="file in report.files" :key="file.name">
            <span v-if="file.expired" :class="ui.expired()">
              {{ file.name }} (deleted after {{ REPORT_FILE_RETENTION_DAYS }} days)
            </span>
            <a v-else :class="ui.link()" :href="file.url">{{ file.name }}</a>
          </template>
          <span v-if="report.filesUnreadable" :class="ui.expired()">
            Attached files couldn’t be read; see the event in PostHog
          </span>
        </dd>
      </dl>
      <AppCollapsible
        :label="`Steps before the report${detail ? ` (${detail.steps.length})` : ''}`"
      >
        <p v-if="detailFailed" :class="ui.handled()">The steps could not load.</p>
        <p v-else-if="!detail" :class="ui.handled()">Loading steps…</p>
        <p v-else-if="detail.stepsUnreadable" :class="ui.handled()">
          The steps couldn’t be read; see the event in PostHog.
        </p>
        <p v-else-if="!detail.steps.length" :class="ui.handled()">No steps were sent.</p>
        <ol v-else :class="ui.steps()">
          <li v-for="(step, index) in detail.steps" :key="index" :class="ui.step()">
            <span :class="ui.stepTime()">{{
              step.timestamp ? formatTime(step.timestamp) : '—'
            }}</span>
            <span :class="ui.stepLevel()" :data-level="step.level">{{ step.level ?? '' }}</span>
            <span>{{ step.name }}</span>
          </li>
        </ol>
      </AppCollapsible>
      <AppFormField label="Status">
        <SegmentedControl
          v-model="status"
          :options="STATUS_OPTIONS"
          label="Status"
          size="md"
          :ui="{ root: 'self-start' }"
        />
      </AppFormField>
      <AppFormField
        label="Internal note"
        :hint="`Only the team sees this. Up to ${formatCount(REPORT_TRIAGE_NOTE_MAX_LENGTH)} characters.`"
      >
        <template #default="{ id }">
          <AppTextarea
            :id="id"
            v-model="note"
            :rows="3"
            :maxlength="REPORT_TRIAGE_NOTE_MAX_LENGTH"
          />
        </template>
      </AppFormField>
      <p v-if="report.handledBy" :class="ui.handled()">
        Last changed by {{ report.handledBy
        }}{{ report.handledAt ? ` on ${formatTime(report.handledAt)}` : '' }}
      </p>
    </div>
    <template #footer>
      <AppDialogCancel size="md" />
      <AppButton type="submit" size="md" color="primary" variant="solid" :loading="saving">
        Save
      </AppButton>
    </template>
  </AppFormDialog>
</template>
