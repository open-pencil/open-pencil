import type { RequestPermissionRequest } from '@agentclientprotocol/sdk/unstable'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import { onUnmounted } from 'vue'

import { permissionQueue, requestPermissionFromUser } from '@/app/ai/agents/acp/permission'

import ChatPermissionDialog from './ChatPermissionDialog.vue'

/** Claude Code leaving Plan mode: the plan it asks to carry out, and its ways to approve it. */
const planRequest: RequestPermissionRequest = {
  sessionId: 'session',
  toolCall: {
    toolCallId: 'exit-plan',
    title: 'Approve Plan',
    rawInput: {
      plan: '# Pricing card\n\n## Plan\n1. Read the page to find free space.\n2. Render a 320×420 card with a **title**, a price, and a button.\n3. Select it and zoom to it.\n\n## Verification\n- Export the card and check its spacing.'
    }
  },
  options: [
    { optionId: 'default', name: 'Yes, manually approve edits', kind: 'allow_once' },
    {
      optionId: 'clear',
      name: 'Yes, clear context (5% used) and use auto mode',
      kind: 'allow_once'
    },
    { optionId: 'auto', name: 'Yes, and use auto mode', kind: 'allow_once' },
    { optionId: 'bypass', name: 'Yes, and bypass permissions', kind: 'allow_once' },
    { optionId: 'plan', name: 'No, keep planning', kind: 'reject_once' }
  ]
}

/** An ordinary tool the agent asks to run, shown with its input. */
const toolRequest: RequestPermissionRequest = {
  sessionId: 'session',
  toolCall: {
    toolCallId: 'bash',
    title: 'Bash',
    rawInput: { command: 'ls ~/Designs', description: 'List the designs folder' }
  },
  options: [
    { optionId: 'once', name: 'Allow once', kind: 'allow_once' },
    { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
    { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
  ]
}

/** Shows the dialog for `request` while the story is open. */
const asking = (request: RequestPermissionRequest) => () => ({
  components: { ChatPermissionDialog },
  setup() {
    const stop = new AbortController()
    void requestPermissionFromUser(request, undefined, stop.signal)
    onUnmounted(() => {
      stop.abort()
      permissionQueue.value = []
    })
  },
  template: '<ChatPermissionDialog />'
})

const meta = {
  title: 'App/Chat/Permission Dialog',
  component: ChatPermissionDialog
} satisfies Meta<typeof ChatPermissionDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Plan: Story = {
  render: asking(planRequest),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    // The plan reads as Markdown, not as the JSON the agent sent.
    await expect(await page.findByRole('heading', { name: 'Pricing card' })).toBeVisible()
    await expect(page.queryByText(/planFilePath|"plan"/)).toBeNull()
  }
}

export const Tool: Story = {
  render: asking(toolRequest),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(await page.findByText(/"command": "ls ~\/Designs"/)).toBeVisible()
  }
}
