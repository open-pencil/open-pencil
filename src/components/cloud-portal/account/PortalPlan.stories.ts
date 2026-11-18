import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { PortalPlan as Plan } from '../types'
import PortalPlan from './PortalPlan.vue'

const MB = 1024 * 1024
const GB = 1024 * MB

const FREE: Plan = {
  storage: { usedBytes: 212 * MB, totalBytes: 300 * MB },
  monthlyCredits: null
}

const PRO: Plan = {
  storage: { usedBytes: 3.4 * GB, totalBytes: 10 * GB },
  monthlyCredits: 3000
}

/** Opening billing, as a spy a story can check. */
type Args = { onOpenBilling?: () => void }

const meta = {
  title: 'App/Cloud/Portal/Plan',
  parameters: { layout: 'padded' }
} satisfies Meta<Args>

export default meta
type Story = StoryObj<Args>

/** A free account on a server that sells plans: its storage, and the way to billing. */
export const Free: Story = {
  args: { onOpenBilling: fn() },
  render: (args) => ({
    components: { PortalPlan },
    setup: () => ({ args, plan: FREE }),
    template: `<PortalPlan :plan="plan" sells @open-billing="args.onOpenBilling" />`
  }),
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Open billing/ }))
    await expect(args.onOpenBilling).toHaveBeenCalled()
  }
}

/** An account on a plan with services: its storage and monthly credits. */
export const WithCredits: Story = {
  render: () => ({
    components: { PortalPlan },
    setup: () => ({ plan: PRO }),
    template: `<PortalPlan :plan="plan" sells />`
  })
}

/** A full account: its files are read-only until it frees space or gets more. */
export const StorageFull: Story = {
  render: () => ({
    components: { PortalPlan },
    setup: () => ({ plan: { ...FREE, storage: { usedBytes: 300 * MB, totalBytes: 300 * MB } } }),
    template: `<PortalPlan :plan="plan" sells />`
  })
}

/** A server that sells nothing, such as a self-hosted one: only what the account includes. */
export const WithoutBilling: Story = {
  render: () => ({
    components: { PortalPlan },
    setup: () => ({ plan: PRO }),
    template: `<PortalPlan :plan="plan" />`
  })
}
