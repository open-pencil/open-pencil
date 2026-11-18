<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'
import IconBug from '~icons/lucide/bug'
import IconMessageSquare from '~icons/lucide/message-square'

import {
  REPORT_FILE_RETENTION_DAYS,
  REPORT_STATUSES,
  REPORT_TRIAGE_NOTE_MAX_LENGTH,
  type InboxReport,
  type ReportDetail,
  type ReportStatus
} from '@open-pencil/feedback/contract'

import { useDateFormat } from '@/app/i18n/date'
import { formatTime } from '@/app/metrics/format'
import type { ReportSaveState } from '@/app/metrics/reports'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { metricsReportTheme } from '@/theme/metrics/dashboard'

import { REPORT_STATUS_LABELS, replyLink, reportApp, reportBrowser, reportSystem } from './labels'
import ReportException from './ReportException.vue'
import ReportSteps from './ReportSteps.vue'

const metricsReport = tv(metricsReportTheme)

/**
 * One report as an issue tracker shows one. The header says what it is and holds its status and
 * reply; the main column leads with what the sender wrote and, for an error, its exceptions, then
 * the document they attached and what the app recorded before; facts about the sender and their
 * build sit in a properties column. Status applies on pick; the team's note saves when left or
 * on ⌘Enter, and the page asks before closing over a note not saved yet.
 */
const {
  report,
  detail = null,
  detailFailed = false,
  saveState = 'idle'
} = defineProps<{
  report: InboxReport
  /** The steps and exceptions, once they have loaded. */
  detail?: ReportDetail | null
  detailFailed?: boolean
  /** Where the last status or note change stands. */
  saveState?: ReportSaveState
}>()
const emit = defineEmits<{
  status: [status: ReportStatus]
  note: [note: string | null]
  /** Opens the attached document read-only. */
  preview: [url: string]
}>()

const ui = metricsReport()
const dates = useDateFormat()
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
const differs = (text: string, saved: string | null) => (text.trim() || null) !== (saved ?? null)
/** Notes not saved yet, such as after a failed save, by report, kept while another is shown. */
const drafts = new Map<string, string>()
watch(
  () => report,
  (next, previous) => {
    if (next.id !== previous.id) {
      if (differs(note.value, previous.triageNote)) drafts.set(previous.id, note.value)
      else drafts.delete(previous.id)
      note.value = drafts.get(next.id) ?? next.triageNote ?? ''
      drafts.delete(next.id)
      return
    }
    // The saved note changed, by this save or a teammate's: follow it unless the field holds
    // writing beyond what was saved before.
    if (next.triageNote !== previous.triageNote && !differs(note.value, previous.triageNote)) {
      note.value = next.triageNote ?? ''
    }
  }
)
const noteChanged = () => differs(note.value, report.triageNote)
function saveNote() {
  if (noteChanged()) emit('note', note.value.trim() || null)
}
useEventListener(globalThis, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (noteChanged()) event.preventDefault()
})
const SAVE_STATE_LABELS: Record<ReportSaveState, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  failed: ''
}

/** What the report is about, in a line: the sender's words, else the error. */
const title = computed(() => report.note?.split('\n')[0] ?? report.error ?? 'No note')
/** The rest of what the sender wrote, when the title doesn't hold all of it. */
const message = computed(() => (report.note && report.note !== title.value ? report.note : null))
const document = computed(() => report.files.find((file) => file.name === 'document.fig'))
const thumbnailFailed = ref(false)
watch(
  () => report.id,
  () => {
    thumbnailFailed.value = false
  }
)
const properties = computed(() =>
  [
    ['Version', report.version],
    ['App', reportApp(report)],
    ['System', reportSystem(report)],
    ['Browser', reportBrowser(report)]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))
)

// Event pages open beside the dashboard; the reply and downloads go through the browser.
const openURL = (url: string) => globalThis.open(url, '_blank', 'noopener')
const reply = () => globalThis.location.assign(replyLink(report))
const download = (url: string) => globalThis.location.assign(url)
</script>

<template>
  <header :class="ui.header()">
    <component
      :is="report.kind === 'error' ? IconBug : IconMessageSquare"
      :class="ui.headerIcon()"
      :data-kind="report.kind"
    />
    <div :class="ui.headerText()">
      <h2 :class="ui.title()">{{ title }}</h2>
      <p :class="ui.subtitle()">
        {{ report.kind === 'error' ? 'Error report' : 'Problem report' }} ·
        {{ dates.relative(report.receivedAt) }}
      </p>
    </div>
    <div :class="ui.actions()">
      <span :class="ui.saveState()" role="status">{{ SAVE_STATE_LABELS[saveState] }}</span>
      <AppSelect
        v-model="status"
        label="Status"
        :options="statusOptions"
        size="sm"
        :ui="{ trigger: 'w-28' }"
      />
      <AppButton
        v-if="report.email"
        size="sm"
        variant="outline"
        aria-keyshortcuts="R"
        @click="reply"
      >
        <template #leading><icon-lucide-reply class="size-3.5" /></template>
        Reply
      </AppButton>
    </div>
  </header>

  <div :class="ui.body()">
    <AppAlert
      v-if="saveState === 'failed'"
      :class="ui.alert()"
      tone="warning"
      heading="The change could not be saved"
      description="Your sign-in may have expired. Reload the page to sign in again."
    />
    <div :class="ui.columns()">
      <div :class="ui.main()">
        <p v-if="message" :class="ui.message()">{{ message }}</p>

        <section v-if="report.kind === 'error'" :class="ui.section()">
          <h3 :class="ui.sectionTitle()">Exception</h3>
          <AppSkeleton v-if="!detail && !detailFailed" class="h-32 w-full" />
          <template v-else-if="detail?.exceptions.length">
            <ReportException
              v-for="(exception, index) in detail.exceptions"
              :key="index"
              :exception="exception"
              :cause="index > 0"
            />
          </template>
          <p v-else :class="ui.note()">{{ report.error ?? 'No exception was sent.' }}</p>
        </section>

        <section v-if="document" :class="ui.section()">
          <h3 :class="ui.sectionTitle()">Document</h3>
          <div :class="ui.document()">
            <img
              v-if="!document.expired && !thumbnailFailed"
              :class="ui.thumbnail()"
              :src="`${document.url}/thumbnail`"
              alt=""
              @error="thumbnailFailed = true"
            />
            <div :class="ui.documentText()">
              <span>{{ document.name }}</span>
              <span :class="ui.note()">
                {{
                  document.expired
                    ? `Deleted after ${REPORT_FILE_RETENTION_DAYS} days`
                    : 'The document open when the report was sent'
                }}
              </span>
            </div>
            <div v-if="!document.expired" :class="ui.documentActions()">
              <AppButton size="sm" variant="outline" @click="emit('preview', document.url)">
                <template #leading><icon-lucide-eye class="size-3.5" /></template>
                Open read-only
              </AppButton>
              <AppButton size="sm" variant="ghost" @click="download(document.url)">
                Download
              </AppButton>
            </div>
          </div>
        </section>
        <p v-if="report.filesUnreadable" :class="ui.note()">
          Some attachments couldn’t be read; see the event in PostHog.
        </p>

        <ReportSteps
          v-if="detail?.steps.length && !detail.stepsUnreadable"
          :steps="detail.steps"
          :received-at="report.receivedAt"
        />
        <section v-else :class="ui.section()">
          <h3 :class="ui.sectionTitle()">Before the report</h3>
          <AppSkeleton v-if="!detail && !detailFailed" class="h-24 w-full" />
          <p v-else-if="detailFailed" :class="ui.note()">The steps could not load.</p>
          <p v-else-if="detail?.stepsUnreadable" :class="ui.note()">
            The steps couldn’t be read; see the event in PostHog.
          </p>
          <p v-else :class="ui.note()">No steps were sent.</p>
        </section>

        <section :class="ui.section()">
          <h3 :class="ui.sectionTitle()">Team note</h3>
          <AppTextarea
            v-model="note"
            :rows="2"
            :maxlength="REPORT_TRIAGE_NOTE_MAX_LENGTH"
            placeholder="What was found, or what happens next. Only the team sees this."
            aria-label="Team note"
            aria-keyshortcuts="Meta+Enter Control+Enter"
            @blur="saveNote"
            @keydown.meta.enter.prevent="saveNote"
            @keydown.ctrl.enter.prevent="saveNote"
          />
          <p v-if="report.handledBy" :class="ui.note()">
            Last changed by {{ report.handledBy }}
            <template v-if="report.handledAt">· {{ dates.relative(report.handledAt) }}</template>
          </p>
        </section>
      </div>

      <aside :class="ui.aside()">
        <dl :class="ui.properties()">
          <dt :class="ui.propertyLabel()">Received</dt>
          <dd :class="ui.propertyValue()">{{ formatTime(report.receivedAt) }}</dd>
          <dt :class="ui.propertyLabel()">From</dt>
          <dd :class="ui.propertyValue()">{{ report.email ?? 'No address left' }}</dd>
          <template v-for="[label, value] in properties" :key="label">
            <dt :class="ui.propertyLabel()">{{ label }}</dt>
            <dd :class="ui.propertyValue()">{{ value }}</dd>
          </template>
          <dt :class="ui.propertyLabel()">Report ID</dt>
          <dd :class="[ui.propertyValue(), 'flex items-center gap-1']">
            <span :class="[ui.mono(), 'truncate']">{{ report.id.slice(0, 8) }}</span>
            <AppCopyButton
              :value="report.id"
              label="Copy report ID"
              copied-label="Copied"
              icon
              size="xs"
            />
          </dd>
        </dl>
        <div :class="ui.links()">
          <button type="button" :class="ui.link()" @click="openURL(report.eventURL)">
            Event in PostHog
            <icon-lucide-external-link class="size-3" data-direction="physical" />
          </button>
          <button
            v-if="detail?.issueURL"
            type="button"
            :class="ui.link()"
            @click="openURL(detail.issueURL)"
          >
            Issue in error tracking
            <icon-lucide-external-link class="size-3" data-direction="physical" />
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
