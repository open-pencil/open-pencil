import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { PortalCreditPack, PortalPlan as Plan, PortalPlanOffer } from '../types'
import PortalPlan from './PortalPlan.vue'

const MB = 1024 * 1024
const GB = 1024 * MB

const FREE: Plan = {
  name: null,
  status: null,
  periodEnd: null,
  cancels: false,
  storage: { usedBytes: 212 * MB, totalBytes: 300 * MB },
  monthlyCredits: null
}

const PRO: Plan = {
  name: 'Pro',
  status: 'active',
  periodEnd: 'Dec 12, 2026',
  cancels: false,
  storage: { usedBytes: 3.4 * GB, totalBytes: 10 * GB },
  monthlyCredits: 3000
}

const OFFERS: PortalPlanOffer[] = [
  { id: 'pro', name: 'Pro', price: '$10.00', storage: '10 GB', credits: '3,000' }
]

const PACKS: PortalCreditPack[] = [
  { id: 'credits-5k', credits: '5,000', price: '$5.00', validDays: 365 },
  { id: 'credits-20k', credits: '20,000', price: '$20.00', validDays: 365 }
]

const meta = {
  title: 'App/Cloud Portal/Plan',
  parameters: { layout: 'padded' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** A free account: its storage against the free allowance, and the plan it can get. */
export const Free: Story = {
  render: () => ({
    components: { PortalPlan },
    setup: () => ({ plan: FREE, offers: OFFERS, onSubscribe: fn() }),
    template: `<PortalPlan :plan="plan" :offers="offers" @subscribe="onSubscribe" />`
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Free')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Manage billing' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Get Pro' }))
  }
}

/** A paid plan, with credits to buy and payment managed with the provider. */
export const Paid: Story = {
  render: () => ({
    components: { PortalPlan },
    setup: () => ({ plan: PRO, offers: OFFERS, packs: PACKS, onBuy: fn(), onManage: fn() }),
    template: `<PortalPlan :plan="plan" :offers="offers" :credit-packs="packs" @buy="onBuy" @manage="onManage" />`
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Renews on Dec 12, 2026.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Get Pro' })).toBeNull()
    await expect(canvas.getAllByRole('button', { name: 'Buy' })).toHaveLength(2)
  }
}

/** A payment failed, and the files outgrew the storage: both said before anything else. */
export const PastDueAndFull: Story = {
  render: () => ({
    components: { PortalPlan },
    setup: () => ({
      plan: { ...PRO, status: 'past_due', storage: { usedBytes: 10 * GB, totalBytes: 10 * GB } }
    }),
    template: `<PortalPlan :plan="plan" />`
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your last payment didn’t go through')).toBeVisible()
    await expect(canvas.getByText('Your files are read-only')).toBeVisible()
  }
}
