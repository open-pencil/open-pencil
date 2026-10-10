import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import CloudInvitationDialog from './CloudInvitationDialog.vue'
import type { CloudInvitationState, CloudInvitationSummary } from './types'

type Args = {
  state: CloudInvitationState
  invitation: CloudInvitationSummary | null
  account: { email: string } | null
  offerDesktop: boolean
  onAccept: () => void
  onSignIn: () => void
  onOpenInDesktop: () => void
}

const invitation: CloudInvitationSummary = {
  documentName: 'Pricing page',
  inviterName: 'Ana Duarte',
  permission: 'edit',
  expiresIn: '6 days',
  recipientHint: 'b•••@studio.example',
  host: 'cloud.openpencil.dev'
}

const meta = {
  title: 'App/Cloud/Invitation Dialog',
  tags: ['autodocs'],
  args: {
    state: 'ready',
    invitation,
    account: { email: 'ben@studio.example' },
    offerDesktop: false,
    onAccept: fn(),
    onSignIn: fn(),
    onOpenInDesktop: fn()
  },
  render: (args) => ({
    components: { CloudInvitationDialog },
    setup: () => ({ args }),
    template: `
      <div class="h-[600px]">
        <CloudInvitationDialog :open="true" :state="args.state" :invitation="args.invitation" :account="args.account" :offer-desktop="args.offerDesktop" @accept="args.onAccept" @sign-in="args.onSignIn" @open-in-desktop="args.onOpenInDesktop" />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {}
export const Loading: Story = { args: { state: 'loading', invitation: null } }
export const SignInFirst: Story = { args: { state: 'sign-in', account: null } }
export const UnknownServer: Story = {
  args: {
    state: 'sign-in',
    account: null,
    invitation: { ...invitation, host: 'design.acme.internal', unknownServer: true }
  }
}
export const WrongAccount: Story = {
  args: { state: 'wrong-account', account: { email: 'ben.personal@example.com' } }
}
export const ViewOnly: Story = { args: { invitation: { ...invitation, permission: 'view' } } }
export const OfferDesktopApp: Story = { args: { offerDesktop: true } }
export const OfferDesktopAppBeforeSignIn: Story = {
  args: { state: 'sign-in', account: null, offerDesktop: true }
}
export const Unavailable: Story = { args: { state: 'unavailable' } }
