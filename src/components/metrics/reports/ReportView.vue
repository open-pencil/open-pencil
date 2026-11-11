<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'

import {
  REPORT_FILE_RETENTION_DAYS,
  REPORT_STATUSES,
  REPORT_TRIAGE_NOTE_MAX_LENGTH,
  type InboxReport,
  type ReportDetail,
  type ReportStatus
} from '@open-pencil/feedback/contract'

import { formatTime } from '@/app/metrics/format'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { metricsInboxTheme } from '@/theme/metrics/dashboard'

import { REPORT_STATUS_LABELS, replyLink, reportBuild, stepLevel, stepTime } from './labels'

const metricsInbox = tv(metricsInboxTheme)

/**
 * One report, read and triaged in place: its status changes on pick, and the team's note saves
 * when the field is left. What the sender wrote leads; their build, files, and the steps the app
 * recorded before it follow.
 */
const {
  report,
  detail = null,
  detailFailed = false,
  saveFailed = false
} = defineProps<{
  report: InboxReport
  /** The steps, once they have loaded. */
  detail?: ReportDetail | null
  detailFailed?: boolean
  /** The last status or note change did not save. */
  saveFailed?: boolean
}>()
const emit = defineEmits<{ status: [status: ReportStatus]; note: [note: string | null] }>()

const ui = metricsInbox()
const statusOptions = REPORT_STATUSES.map((value) => ({
  value,
  label: REPORT_STATUS_LABELS[value].label
}))
const status = computed({
  get: () => report.status,
  set: (value: ReportStatus) => {
    if (value !== report.status) emit('status', value)
  }
})

// The note follows the report shown, and saves once the field is left with something changed.
const note = ref(report.triageNote ?? '')
watch(
  () => [report.id, report.triageNote],
  () => {
    note.value = report.triageNote ?? ''
  }
)
function saveNote() {
  const next = note.value.trim() || null
  if (next !== (report.triageNote ?? null)) emit('note', next)
}

const kind = computed(() => (report.kind === 'error' ? 'Error report' : 'Problem report'))
// Event pages open beside the dashboard; the reply and downloads go through the browser.
const openURL = (url: string) => globalThis.open(url, '_blank', 'noopener')
const reply = () => globalThis.location.assign(replyLink(report))
const download = (url: string) => globalThis.location.assign(url)
</script>

<template>
  <div :class="ui.detailBar()">
    <AppSelect
      v-model="status"
      label="Status"
      :options="statusOptions"
      size="sm"
      :ui="{ trigger: 'w-32' }"
    />
    <div class="ms-auto flex items-center gap-1">
      <AppButton v-if="report.email" size="sm" variant="ghost" @click="reply">
        <template #leading><icon-lucide-reply class="size-3.5" /></template>
        Reply
      </AppButton>
      <AppButton size="sm" variant="ghost" @click="openURL(report.eventURL)">
        <template #leading>
          <icon-lucide-external-link class="size-3.5" data-direction="physical" />
        </template>
        PostHog
      </AppButton>
    </div>
  </div>

  <div :class="ui.detailBody()">
    <AppAlert
      v-if="saveFailed"
      tone="warning"
      heading="The change could not be saved"
      description="Your sign-in may have expired. Reload the page to sign in again."
    />

    <section class="flex flex-col gap-2">
      <p :class="ui.kind()">{{ kind }}</p>
      <p v-if="report.note" :class="ui.message()">{{ report.note }}</p>
      <p v-if="report.error" :class="ui.error()">{{ report.error }}</p>
      <p :class="ui.facts()">
        <span>{{ report.email ?? 'No address left' }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ reportBuild(report) }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ formatTime(report.receivedAt) }}</span>
      </p>
      <p :class="ui.facts()">
        <span :class="ui.reportId()">{{ report.id }}</span>
        <AppCopyButton :value="report.id" label="Copy ID" copied-label="Copied" size="sm" />
      </p>
    </section>

    <section v-if="report.files.length || report.filesUnreadable">
      <h3 :class="ui.sectionTitle()">Attachments</h3>
      <div :class="ui.files()">
        <div v-for="file in report.files" :key="file.name" :class="ui.file()">
          <icon-lucide-paperclip class="size-3.5 shrink-0 text-muted" />
          <span :class="ui.fileName()">{{ file.name }}</span>
          <span v-if="file.expired" :class="ui.fileGone()">
            Deleted after {{ REPORT_FILE_RETENTION_DAYS }} days
          </span>
          <AppButton v-else size="sm" variant="ghost" @click="download(file.url)">
            Download
          </AppButton>
        </div>
        <div v-if="report.filesUnreadable" :class="ui.file()">
          <span :class="ui.fileGone()">Some attachments couldn’t be read; see PostHog.</span>
        </div>
      </div>
    </section>

    <section>
      <h3 :class="ui.sectionTitle()">Steps before the report</h3>
      <p v-if="detailFailed" :class="ui.stepsNote()">The steps could not load.</p>
      <p v-else-if="!detail" :class="ui.stepsNote()">Loading…</p>
      <p v-else-if="detail.stepsUnreadable" :class="ui.stepsNote()">
        The steps couldn’t be read; see PostHog.
      </p>
      <p v-else-if="!detail.steps.length" :class="ui.stepsNote()">No steps were sent.</p>
      <ol v-else :class="ui.steps()">
        <li v-for="(step, index) in detail.steps" :key="index" :class="ui.step()">
          <span :class="ui.stepTime()">{{ stepTime(step.timestamp) }}</span>
          <span :class="ui.stepLevel()" :data-level="step.level">
            <span aria-hidden="true">{{ stepLevel(step.level) }}</span>
            <span v-if="step.level" class="sr-only">{{ step.level }}</span>
          </span>
          <span :class="ui.stepName()">{{ step.name }}</span>
        </li>
      </ol>
    </section>

    <section>
      <h3 :class="ui.sectionTitle()">Note for the team</h3>
      <AppTextarea
        v-model="note"
        :rows="2"
        :maxlength="REPORT_TRIAGE_NOTE_MAX_LENGTH"
        placeholder="What was found, or what happens next"
        aria-label="Note for the team"
        @blur="saveNote"
      />
      <p :class="ui.noteHint()">
        Only the team sees this.
        <template v-if="report.handledBy">
          Last changed by {{ report.handledBy }}
          <template v-if="report.handledAt">on {{ formatTime(report.handledAt) }}</template
          >.
        </template>
      </p>
    </section>
  </div>
</template>
