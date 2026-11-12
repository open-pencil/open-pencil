import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { countBy } from 'es-toolkit'
import { computed, ref, shallowRef } from 'vue'

import type {
  InboxReport,
  ReportDetail,
  ReportInboxFilter,
  ReportStatus
} from '@open-pencil/feedback/contract'

import ReportInbox from './ReportInbox.vue'

// Illustrative reports, as the feedback Worker answers the inbox.
const base: Pick<
  InboxReport,
  | 'version'
  | 'arch'
  | 'browser'
  | 'error'
  | 'files'
  | 'filesUnreadable'
  | 'triageNote'
  | 'handledBy'
  | 'handledAt'
> = {
  version: '0.16.0',
  arch: 'arm64',
  browser: 'unknown',
  error: null,
  files: [],
  filesUnreadable: false,
  triageNote: null,
  handledBy: null,
  handledAt: null
}

const REPORTS: InboxReport[] = [
  {
    ...base,
    id: '0b7f3c1e-5d2a-4f61-9c3b-8e2a1d4f6a01',
    kind: 'problem',
    receivedAt: '2026-11-11T09:42:00.000Z',
    note: 'Exporting a frame to PDF hangs at 90% when it has a shader fill.',
    email: 'ana@example.com',
    platform: 'macos',
    app: 'desktop',
    files: [
      {
        name: 'document.fig',
        url: 'https://feedback.openpencil.dev/admin/reports/0b7f3c1e-5d2a-4f61-9c3b-8e2a1d4f6a01/files/document.fig',
        expired: false
      }
    ],
    eventURL: 'https://eu.posthog.com/project/1/events/a/2026-11-11T09:42:00.000Z',
    status: 'open'
  },
  {
    ...base,
    id: '5c2e8a90-1b3d-4e7f-a6c5-2d9b0e1f3a02',
    kind: 'error',
    receivedAt: '2026-11-10T17:05:00.000Z',
    note: 'It crashed right after I pasted from Figma.',
    email: null,
    platform: 'windows',
    arch: 'x64',
    app: 'web',
    browser: 'chrome',
    error: "TypeError: Cannot read properties of undefined (reading 'children')",
    eventURL: 'https://eu.posthog.com/project/1/events/b/2026-11-10T17:05:00.000Z',
    status: 'open'
  },
  {
    ...base,
    id: '9a1d4b7c-3e5f-4a2b-8c6d-0f1e2a3b4c03',
    kind: 'problem',
    receivedAt: '2026-11-09T11:20:00.000Z',
    note: 'Auto layout gap resets to 0 after undo.',
    email: 'lee@example.com',
    platform: 'linux',
    arch: 'x64',
    app: 'desktop',
    eventURL: 'https://eu.posthog.com/project/1/events/c/2026-11-09T11:20:00.000Z',
    status: 'replied',
    triageNote: 'Reproduced; asked for the file.',
    handledBy: 'dan@openpencil.dev',
    handledAt: '2026-11-09T15:00:00.000Z'
  }
]

const meta = {
  title: 'App/Metrics/Reports',
  parameters: { layout: 'padded' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const [PROBLEM, ERROR] = REPORTS

const DETAILS: Partial<Record<string, Omit<ReportDetail, keyof InboxReport>>> = {
  [REPORTS[0]?.id ?? '']: {
    stepsUnreadable: false,
    exceptions: [],
    issueURL: null,
    steps: [
      {
        name: 'document.opened',
        category: 'document',
        level: 'info',
        timestamp: '2026-11-11T09:40:12.000Z',
        attributes: { format: 'fig', pages: 3, bytes: 482113, source: 'local' }
      },
      {
        name: 'export.started',
        category: 'export',
        level: 'info',
        timestamp: '2026-11-11T09:41:30.000Z',
        attributes: { format: 'pdf', frames: 1, scale: 2 }
      },
      {
        name: 'shader.frame_failed',
        category: 'render',
        level: 'warning',
        timestamp: '2026-11-11T09:41:58.000Z',
        attributes: { shader: 'mesh-gradient', backend: 'webgpu', reason: 'device lost' }
      }
    ]
  },
  [REPORTS[1]?.id ?? '']: {
    stepsUnreadable: false,
    issueURL: 'https://eu.posthog.com/project/1/error_tracking/0199aaaa',
    steps: [
      {
        name: 'clipboard.paste',
        category: 'clipboard',
        level: 'info',
        timestamp: '2026-11-10T17:04:51.000Z',
        attributes: { source: 'figma', nodes: 48 }
      },
      {
        name: 'runtime.error',
        category: 'runtime',
        level: 'error',
        timestamp: '2026-11-10T17:04:52.000Z',
        attributes: { type: 'TypeError' }
      }
    ],
    exceptions: [
      {
        type: 'TypeError',
        message: "Cannot read properties of undefined (reading 'children')",
        handled: false,
        source: 'window',
        frames: [
          {
            function: 'collectChildren',
            file: 'packages/fig/src/clipboard/nodes.ts',
            line: 214,
            column: 31,
            inApp: true,
            resolved: true
          },
          {
            function: 'convertClipboardNodes',
            file: 'packages/fig/src/clipboard/convert.ts',
            line: 88,
            column: 12,
            inApp: true,
            resolved: true
          },
          {
            function: 'Array.map',
            file: null,
            line: null,
            column: null,
            inApp: false,
            resolved: false
          },
          {
            function: 'r',
            file: 'https://app.openpencil.dev/assets/vendor-kiwi.js',
            line: 1,
            column: 48812,
            inApp: false,
            resolved: false
          },
          {
            function: 'r',
            file: 'https://app.openpencil.dev/assets/vendor-kiwi.js',
            line: 1,
            column: 51003,
            inApp: false,
            resolved: false
          },
          {
            function: 'pasteFromClipboard',
            file: 'src/app/editor/clipboard/paste.ts',
            line: 61,
            column: 9,
            inApp: true,
            resolved: true
          },
          {
            function: 'callWithAsyncErrorHandling',
            file: 'node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js',
            line: 199,
            column: 21,
            inApp: false,
            resolved: true
          }
        ]
      }
    ]
  }
}
const detailOf = (report: InboxReport | null): ReportDetail | null => {
  if (!report) return null
  const extra = DETAILS[report.id]
  return extra
    ? { ...report, ...extra }
    : { ...report, steps: [], stepsUnreadable: false, exceptions: [], issueURL: null }
}

const story = (first: InboxReport | undefined): Story => ({
  render: () => ({
    components: { ReportInbox },
    setup: () => {
      const reports = shallowRef(REPORTS)
      const selected = shallowRef<InboxReport | null>(first ?? null)
      const filter = ref<ReportInboxFilter>('all')
      const query = ref('')
      const detail = computed(() => detailOf(selected.value))
      const saveState = ref('idle')
      function update(report: InboxReport, change: Partial<InboxReport>) {
        reports.value = reports.value.map((each) =>
          each.id === report.id ? { ...each, ...change } : each
        )
        selected.value = reports.value.find((each) => each.id === report.id) ?? null
        saveState.value = 'saved'
      }
      return {
        reports,
        selected,
        filter,
        query,
        detail,
        counts: computed(() => {
          const byStatus: Partial<Record<ReportStatus, number>> = countBy(
            reports.value,
            (report) => report.status
          )
          return {
            open: byStatus.open ?? 0,
            replied: byStatus.replied ?? 0,
            closed: byStatus.closed ?? 0,
            all: reports.value.length
          }
        }),
        saveState,
        select: (report: InboxReport) => {
          selected.value = report
          saveState.value = 'idle'
        },
        setStatus: (report: InboxReport, status: ReportStatus) => update(report, { status }),
        setNote: (report: InboxReport, note: string | null) => update(report, { triageNote: note })
      }
    },
    template: `
      <div class="max-w-7xl">
        <ReportInbox
          v-model:filter="filter"
          v-model:query="query"
          :reports="reports"
          :counts="counts"
          :selected="selected"
          :detail="detail"
          :save-state="saveState"
          @select="select"
          @status="setStatus"
          @note="setNote"
        />
      </div>`
  })
})

/** A problem report: what the sender wrote, the document they had open, and the steps before. */
export const Problem = story(PROBLEM)

/** An error report: its exception with the app's frames leading and library frames folded. */
export const Error = story(ERROR)
