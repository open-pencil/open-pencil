import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { FollowTarget } from '@/app/presence/types'

import { colors, room } from './examples/room'
import type { PresencePersonRow } from './presence'
import PresenceAvatars from './PresenceAvatars.vue'

const crowd: PresencePersonRow[] = [
  ...room,
  { clientId: 4, name: 'Cleo', color: colors.cleo, agents: [] },
  { clientId: 5, name: 'Eli', color: colors.ben, agents: [] },
  { clientId: 6, name: 'Fay', color: colors.ana, agents: [] }
]

type Args = { rows: PresencePersonRow[]; following: FollowTarget | null; connected: boolean }

const meta = {
  title: 'Collaboration/Presence Avatars',
  component: PresenceAvatars,
  tags: ['autodocs'],
  args: {
    rows: room,
    following: null,
    connected: true,
    onFollow: fn(),
    onRename: fn(),
    onLeave: fn()
  },
  render: (args) => ({
    components: { PresenceAvatars },
    setup: () => ({ args }),
    template:
      '<div class="flex justify-end bg-panel p-3 pb-48"><PresenceAvatars v-bind="args" /></div>'
  })
} satisfies Meta<Args & { onFollow: () => void; onRename: () => void; onLeave: () => void }>

export default meta
type Story = StoryObj<typeof meta>

export const Room: Story = {}

export const FollowingSomeone: Story = {
  args: { following: { kind: 'person', clientId: 2 } }
}

export const YourMenu: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Dana (you)' }))
    const menu = within(document.body)
    await userEvent.click(await menu.findByRole('button', { name: 'Leave room' }))
    await expect(args.onLeave).toHaveBeenCalledOnce()
  }
}

export const ManyPeople: Story = {
  args: { rows: crowd }
}

export const Alone: Story = {
  args: { rows: room.slice(0, 1), connected: false }
}
