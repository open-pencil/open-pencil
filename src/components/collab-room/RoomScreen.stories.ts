import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import RoomScreen from './RoomScreen.vue'

type Args = {
  status: 'joining' | 'waiting'
  name: string
  copied: boolean
  nameHint: string | null
  desktopLink: string | null
  downloadURL: string | null
  onCopyLink: () => void
  onLeave: () => void
  onRename: (name: string) => void
}

const meta = {
  title: 'Collaboration/Room Screen',
  component: RoomScreen,
  tags: ['autodocs'],
  args: {
    status: 'waiting',
    name: 'Teal Fox',
    copied: false,
    nameHint: null,
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

export const Joining: Story = {
  args: { status: 'joining' }
}

export const Waiting: Story = {}

export const WaitingWithGeneratedName: Story = {
  args: {
    nameHint: 'You’re Teal Fox in this room. Set your name so others know who you are.'
  }
}

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
    await userEvent.type(canvas.getByLabelText('Your name'), 'Dana{Enter}')
    await expect(args.onRename).toHaveBeenCalledWith('Dana')
  }
}
