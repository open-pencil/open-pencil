import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref, shallowRef } from 'vue'

import type { InboxReport, ReportDetail, ReportStatus } from '@open-pencil/feedback/contract'

import ReportDetailDialog from './ReportDetailDialog.vue'
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

/** The inbox's open reports, with search, filters, and each row's menu. */
export const Inbox: Story = {
  render: () => ({
    components: { ReportInbox },
    setup: () => {
      const reports = shallowRef(REPORTS)
      const setStatus = (report: InboxReport, status: ReportStatus) => {
        reports.value = reports.value.map((each) =>
          each.id === report.id ? { ...each, status } : each
        )
      }
      return { reports, setStatus }
    },
    template: `<div class="h-150 max-w-5xl"><ReportInbox :reports="reports" @triage="setStatus" /></div>`
  })
}

const DETAIL: ReportDetail = {
  ...REPORTS[0],
  stepsUnreadable: false,
  steps: [
    {
      name: 'document.opened',
      category: 'document',
      level: 'info',
      timestamp: '2026-11-11T09:40:12.000Z'
    },
    {
      name: 'export.started',
      category: 'export',
      level: 'info',
      timestamp: '2026-11-11T09:41:30.000Z'
    },
    {
      name: 'shader.frame_failed',
      category: 'render',
      level: 'warning',
      timestamp: '2026-11-11T09:41:58.000Z'
    }
  ]
}

/** One report open, its steps loaded, ready to triage. */
export const Detail: Story = {
  render: () => ({
    components: { ReportDetailDialog },
    setup: () => ({ open: ref(true), report: DETAIL, detail: DETAIL }),
    template: `<ReportDetailDialog v-model:open="open" :report="report" :detail="detail" />`
  })
}
