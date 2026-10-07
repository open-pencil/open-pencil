import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { FollowTarget } from '@/app/presence/types'

import { room } from './examples/room'
import PresenceList from './PresenceList.vue'
import type { PresencePersonRow } from './rows'

type Args = { rows: PresencePersonRow[]; following: FollowTarget | null }

const meta = {
  title: 'App/Collaboration/Presence List',
  component: PresenceList,
  tags: ['autodocs'],
  args: { rows: room, following: null, onFollow: fn(), onRename: fn() },
  render: (args) => ({
    components: { PresenceList },
    setup: () => ({ args }),
    template: '<div class="w-56 bg-panel p-3"><PresenceList v-bind="args" /></div>'
  })
} satisfies Meta<Args & { onFollow: () => void; onRename: () => void }>

export default meta
type Story = StoryObj<typeof meta>

export const Room: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Follow Orbit' }))
    await expect(args.onFollow).toHaveBeenCalledWith({ kind: 'agent', agentId: 'orbit' })
  }
}

export const FollowingAnAgent: Story = {
  args: { following: { kind: 'agent', agentId: 'orbit' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Stop following Orbit' }))
    await expect(args.onFollow).toHaveBeenCalledWith(null)
  }
}

export const RenamingYourAgent: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Rename Fern' }))
    const input = canvas.getByRole('textbox', { name: 'Agent name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Juniper{Enter}')
    await expect(args.onRename).toHaveBeenCalledWith('fern', 'Juniper')
  }
}

export const Alone: Story = {
  args: { rows: room.slice(0, 1) }
}
