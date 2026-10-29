import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { WorkspaceMembers } from '@open-pencil/cloud/contract'

import CloudWorkspaceMembersDialog from './CloudWorkspaceMembersDialog.vue'

type Args = {
  members: WorkspaceMembers
  canManage: boolean
  resent: { invitationId: string; link: string } | null
  onResend: (invitationId: string) => void
}

const members: WorkspaceMembers = {
  members: [
    {
      userId: 'user-ana',
      name: 'Ana Duarte',
      email: 'ana@studio.example',
      image: null,
      role: 'admin',
      joinedAt: '2026-03-03T09:00:00.000Z'
    },
    {
      userId: 'user-ben',
      name: 'Ben Ortiz',
      email: 'ben@studio.example',
      image: null,
      role: 'editor',
      joinedAt: '2026-04-11T09:00:00.000Z'
    },
    {
      userId: 'user-mia',
      name: 'Mia Chen',
      email: 'mia@client.example',
      image: null,
      role: 'viewer',
      joinedAt: '2026-06-12T09:00:00.000Z'
    }
  ],
  invitations: [
    {
      id: '6f1d3a52-1d4e-4c7b-9a1e-2f9b9c1a0d11',
      email: 'chloe@agency.example',
      role: 'editor',
      invitedBy: { id: 'user-ana', name: 'Ana Duarte' },
      invitedAt: '2026-10-20T09:00:00.000Z',
      expiresAt: '2026-10-27T09:00:00.000Z'
    }
  ]
}

const meta = {
  title: 'App/Cloud/Workspace Members',
  tags: ['autodocs'],
  args: { members, canManage: true, resent: null, onResend: fn() },
  render: (args) => ({
    components: { CloudWorkspaceMembersDialog },
    setup: () => ({ args }),
    template: `
      <div class="h-[640px]">
        <CloudWorkspaceMembersDialog
          :open="true"
          workspace-name="Spring campaign"
          self="user-ana"
          :can-manage="args.canManage"
          :members="args.members"
          :resent="args.resent"
          @resend="args.onResend"
        />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Members: Story = {}

export const Invited: Story = {
  play: async ({ args }) => {
    const page = within(document.body)
    await userEvent.click(await page.findByRole('tab', { name: /Invited/ }))
    await userEvent.click(await page.findByRole('button', { name: 'Resend' }))
    await expect(args.onResend).toHaveBeenCalledWith('6f1d3a52-1d4e-4c7b-9a1e-2f9b9c1a0d11')
  }
}

export const InvitationSentAgain: Story = {
  args: {
    resent: {
      invitationId: '6f1d3a52-1d4e-4c7b-9a1e-2f9b9c1a0d11',
      link: 'https://cloud.studio.example/invitations/accept#token'
    }
  },
  play: async () => {
    const page = within(document.body)
    await userEvent.click(await page.findByRole('tab', { name: /Invited/ }))
    await expect(page.queryByRole('button', { name: 'Resend' })).toBeNull()
    await expect(page.getByRole('button', { name: 'Copy invitation link' })).toBeVisible()
  }
}

export const MemberCannotManage: Story = {
  args: { canManage: false, members: { ...members, invitations: [] } }
}
