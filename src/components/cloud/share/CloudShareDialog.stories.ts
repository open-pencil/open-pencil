import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import CloudShareDialog from './CloudShareDialog.vue'
import type { ShareLinkState, ShareMember } from './types'

type Args = {
  members: ShareMember[]
  link: ShareLinkState
  canManage: boolean
  copied: boolean
  onInvite: (email: string, permission: string) => void
}

const members: ShareMember[] = [
  {
    id: 'user-ana',
    name: 'Ana Duarte',
    email: 'ana@studio.example',
    permission: 'owner',
    you: true
  },
  { id: 'user-ben', name: 'Ben Ortiz', email: 'ben@studio.example', permission: 'edit' },
  { id: 'user-mia', name: 'Mia Chen', email: 'mia@client.example', permission: 'view' },
  {
    id: 'invite-chloe',
    name: 'chloe@agency.example',
    email: 'chloe@agency.example',
    permission: 'edit',
    pendingUntil: 'in 6 days'
  }
]

const meta = {
  title: 'App/Cloud/Share Dialog',
  tags: ['autodocs'],
  args: {
    members,
    link: { access: 'restricted' },
    canManage: true,
    copied: false,
    onInvite: fn()
  },
  render: (args) => ({
    components: { CloudShareDialog },
    setup: () => ({ args }),
    template: `
      <div class="h-[640px]">
        <CloudShareDialog
          :open="true"
          document-name="Homepage redesign"
          :workspace="{ name: 'Design team', memberCount: 4, permission: 'edit' }"
          :members="args.members"
          :link="args.link"
          :can-manage="args.canManage"
          :copied="args.copied"
          @invite="args.onInvite"
        />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const OnlyPeopleWithAccess: Story = {}

export const AnyoneWithTheLink: Story = {
  args: { link: { access: 'link', permission: 'view', copyable: true } }
}

export const LinkCopied: Story = {
  args: { link: { access: 'link', permission: 'view', copyable: true }, copied: true }
}

export const LinkMadeOnAnotherDevice: Story = {
  args: { link: { access: 'link', permission: 'edit', copyable: false } }
}

export const ViewerCannotManage: Story = {
  args: {
    canManage: false,
    members: members.map((member) => ({ ...member, you: member.id === 'user-mia' })),
    link: { access: 'link', permission: 'view', copyable: true }
  }
}
