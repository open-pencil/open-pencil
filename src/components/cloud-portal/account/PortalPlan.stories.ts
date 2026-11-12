import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { PortalCreditPack, PortalPlan as Plan, PortalPlanOffer } from '../types'
import PortalPlan from './PortalPlan.vue'

const MB = 1024 * 1024
const GB = 1024 * MB

const FREE: Plan = {
  known: true,
  name: null,
  status: null,
  periodEnd: null,
  cancels: false,
  storage: { usedBytes: 212 * MB, totalBytes: 300 * MB },
  monthlyCredits: null
}

const PRO: Plan = {
  known: true,
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

/** The plan's actions, as spies a story can check. */
type Args = {
  onSubscribe?: (id: string) => void
  onBuy?: (id: string) => void
  onManage?: () => void
}

const meta = {
  title: 'App/Cloud Portal/Plan',
  parameters: { layout: 'padded' }
} satisfies Meta<Args>

export default meta
type Story = StoryObj<Args>

/** A free account: its storage against the free allowance, and the plan it can get. */
export const Free: Story = {
  args: { onSubscribe: fn(), onManage: fn() },
  render: (args) => ({
    components: { PortalPlan },
    setup: () => ({ args, plan: FREE, offers: OFFERS }),
    template: `<PortalPlan :plan="plan" :offers="offers" @subscribe="args.onSubscribe" @manage="args.onManage" />`
  }),
  play: async ({ args, canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole('button')
    // The only action is subscribing to the one plan offered; nothing to manage yet.
    await expect(buttons).toHaveLength(1)
    const [subscribe] = buttons
    if (subscribe) await userEvent.click(subscribe)
    await expect(args.onSubscribe).toHaveBeenCalledWith('pro')
    await expect(args.onManage).not.toHaveBeenCalled()
  }
}

/** A paid plan, with credits to buy and payment managed with the provider. */
export const Paid: Story = {
  args: { onSubscribe: fn(), onBuy: fn(), onManage: fn() },
  render: (args) => ({
    components: { PortalPlan },
    setup: () => ({ args, plan: PRO, offers: OFFERS, packs: PACKS }),
    template: `<PortalPlan :plan="plan" :offers="offers" :credit-packs="packs" @subscribe="args.onSubscribe" @buy="args.onBuy" @manage="args.onManage" />`
  }),
  play: async ({ args, canvasElement }) => {
    // Manage billing, then one Buy per pack; a plan already held is never offered again.
    const [manage, ...buy] = within(canvasElement).getAllByRole('button')
    await expect(buy).toHaveLength(PACKS.length)
    const [, larger] = buy
    if (larger) await userEvent.click(larger)
    await expect(args.onBuy).toHaveBeenCalledWith('credits-20k')
    if (manage) await userEvent.click(manage)
    await expect(args.onManage).toHaveBeenCalledOnce()
    await expect(args.onSubscribe).not.toHaveBeenCalled()
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
    await expect(canvasElement.querySelectorAll('[data-slot="alert"]')).toHaveLength(2)
  }
}

/** Billing can't be asked: Cloud's limits and usage still show, but no plan is named or sold. */
export const Unknown: Story = {
  render: () => ({
    components: { PortalPlan },
    setup: () => ({ plan: { ...FREE, known: false }, offers: OFFERS }),
    template: `<PortalPlan :plan="plan" :offers="offers" />`
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0)
  }
}
