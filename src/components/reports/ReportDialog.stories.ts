import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { ref } from 'vue'

import type { ReportSendFailure } from '@/app/reports/send'

import ReportDialog from './ReportDialog.vue'

type Args = {
  kind: 'error' | 'problem'
  note: string
  hasDocument: boolean
  preparingDocument: boolean
  documentFailed: boolean
  canSend: boolean
  sending: boolean
  failure: ReportSendFailure | null
  onSend: () => void
}

const errorPreview = JSON.stringify(
  {
    kind: 'error',
    exceptions: [
      {
        type: 'TypeError',
        value: 'nodes.map is not a function',
        mechanism: { handled: false, synthetic: false, type: 'window' },
        stacktrace: {
          type: 'raw',
          frames: [
            {
              platform: 'web:javascript',
              filename: 'tauri://localhost/assets/index-a1b2c3d4.js',
              function: 'Le',
              lineno: 1,
              colno: 52114,
              in_app: true
            }
          ]
        }
      }
    ],
    version: '0.17.0',
    platform: 'macos',
    arch: 'arm64',
    app: 'desktop',
    browser: 'unknown'
  },
  null,
  2
)

const meta = {
  title: 'App/Reports/Dialog',
  tags: ['autodocs'],
  args: {
    kind: 'error',
    note: '',
    hasDocument: true,
    preparingDocument: false,
    documentFailed: false,
    canSend: true,
    sending: false,
    failure: null,
    onSend: fn()
  },
  render: (args) => ({
    components: { ReportDialog },
    setup: () => ({
      args,
      note: ref(args.note),
      email: ref(''),
      includeActivity: ref(true),
      attachDocument: ref(false),
      preview: errorPreview
    }),
    template: `
      <div class="h-170">
        <ReportDialog
          :open="true"
          v-model:note="note"
          v-model:email="email"
          v-model:include-activity="includeActivity"
          v-model:attach-document="attachDocument"
          :kind="args.kind"
          :has-document="args.hasDocument"
          :preparing-document="args.preparingDocument"
          :document-failed="args.documentFailed"
          :preview="preview"
          :can-send="args.canSend"
          :sending="args.sending"
          :failure="args.failure"
          @send="args.onSend"
        />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Error: Story = {}
export const Problem: Story = {
  args: { kind: 'problem', note: 'Text jumps when I resize the frame.' }
}
export const ProblemWithoutDescription: Story = {
  args: { kind: 'problem', canSend: false },
  play: async ({ canvasElement }) => {
    // The dialog renders in a portal on the document body.
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector('[data-test-id="report-send"]')
      ).toBeDisabled()
    )
  }
}
export const Sending: Story = { args: { sending: true } }
export const ReportFailed: Story = { args: { failure: 'report' } }
export const UploadFailed: Story = { args: { failure: 'files' } }
export const DocumentFailed: Story = { args: { documentFailed: true } }
