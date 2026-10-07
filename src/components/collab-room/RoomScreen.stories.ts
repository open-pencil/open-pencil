import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { PendingRoomStatus } from '@/app/collab/room/status'

import RoomScreen from './RoomScreen.vue'

type Args = {
  status: PendingRoomStatus
  sender: string | null
  othersWaiting: string[]
  name: string
  copied: boolean
  desktopLink: string | null
  downloadURL: string | null
  onCopyLink: () => void
  onLeave: () => void
  onRename: (name: string) => void
}

const meta = {
  title: 'App/Collaboration/Room Screen',
  component: RoomScreen,
  tags: ['autodocs'],
  args: {
    status: 'waiting',
    sender: null,
    othersWaiting: [],
    name: 'Teal Fox',
    copied: false,
    desktopLink: null,
    downloadURL: null,
    onCopyLink: fn(),
    onLeave: fn(),
    onRename: fn()
  },
  render: (args) => ({
    components: { RoomScreen },
    setup: () => ({ args }),
    template: '<div class="relative h-[480px] bg-canvas"><RoomScreen v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Connecting: Story = {
  args: { status: 'connecting' }
}

export const LookingForPeople: Story = {
  args: { status: 'looking' }
}

export const ReceivingTheFile: Story = {
  args: { status: 'receiving', sender: 'Ana' }
}

export const Unreachable: Story = {
  args: { status: 'unreachable' }
}

export const WaitingWithOthers: Story = {
  args: { othersWaiting: ['Ben', 'Teal Fox'] }
}

export const Waiting: Story = {}

export const WaitingInDesktopBrowser: Story = {
  args: {
    desktopLink: 'openpencil://join?room=abcdefghijklmnopqrstuvwxyz012345',
    downloadURL: 'https://github.com/open-pencil/open-pencil/releases/latest'
  }
}

export const LinkCopied: Story = {
  args: { copied: true }
}

export const Actions: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Copy link' }))
    await expect(args.onCopyLink).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Leave' }))
    await expect(args.onLeave).toHaveBeenCalledOnce()
  }
}

export const Rename: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Change' }))
    const body = within(canvasElement.ownerDocument.body)
    const input = await body.findByLabelText('Your name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Dana{Enter}')
    await expect(args.onRename).toHaveBeenCalledWith('Dana')
  }
}
