import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import type { MCPFailure, MCPFailureCode } from '@/app/automation/mcp/failure'

import MCPFailureAlert from './MCPFailureAlert.vue'

/** One representative failure per reason, mirroring what each path records. */
const reasons: Record<MCPFailureCode, MCPFailure> = {
  'not-installed': {
    code: 'not-installed',
    detail: '/opt/homebrew/bin, /usr/local/bin, /Users/you/.bun/bin'
  },
  'permission-denied': {
    code: 'permission-denied',
    detail: 'shell command openpencil-mcp-http not allowed by ACL'
  },
  exited: {
    code: 'exited',
    detail: 'Error: listen EADDRINUSE: address already in use 127.0.0.1:7600'
  },
  timeout: { code: 'timeout', detail: 'no health response from http://127.0.0.1:7600/health' },
  rejected: { code: 'rejected', detail: 'HTTP 401' },
  malformed: { code: 'malformed', detail: 'HTTP 200' },
  unreachable: { code: 'unreachable', detail: 'http://127.0.0.1:7600/mcp' },
  unknown: { code: 'unknown', detail: 'Failed to fetch' }
}

const meta = {
  title: 'Settings/MCP/Failure alert',
  component: MCPFailureAlert,
  args: { failure: reasons.timeout, restarting: false, externallyManaged: false },
  render: (args) => ({
    components: { MCPFailureAlert },
    setup: () => ({ args }),
    template: `
      <div class="max-w-xl bg-panel p-4 text-surface">
        <MCPFailureAlert
          :failure="args.failure"
          :restarting="args.restarting"
          :externally-managed="args.externallyManaged"
        />
      </div>`
  })
} satisfies Meta<{ failure: MCPFailure; restarting: boolean; externallyManaged: boolean }>

export default meta
type Story = StoryObj<typeof meta>

export const StartupTimeout: Story = {}
export const NotInstalled: Story = { args: { failure: reasons['not-installed'] } }
export const RejectedToken: Story = { args: { failure: reasons.rejected } }
export const Unreachable: Story = { args: { failure: reasons.unreachable } }
export const InternallyManaged: Story = { args: { restarting: true } }
export const ExternallyManaged: Story = { args: { externallyManaged: true } }

/** Every reason side by side: copy, guidance, and whether detail is offered. */
export const AllReasons: Story = {
  render: () => ({
    components: { MCPFailureAlert },
    setup: () => ({ failures: Object.values(reasons) }),
    template: `
      <div class="flex max-w-xl flex-col gap-3 bg-panel p-4 text-surface">
        <MCPFailureAlert v-for="failure in failures" :key="failure.code" :failure="failure" />
      </div>`
  })
}

export const DetailsExpandOnDemand: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Collapsed payloads stay unmounted, so the alert announces only its summary.
    await expect(canvas.queryByTestId('settings-mcp-failure-detail')).toBeNull()
    const trigger = canvas.getByRole('button', { name: 'Details' })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    await expect(canvas.getByTestId('settings-mcp-failure-detail')).toBeVisible()
  }
}
