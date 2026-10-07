import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AvatarStack from './AvatarStack.vue'
import { room } from './examples/room'
import type { PresencePersonRow } from './rows'

type Args = {
  people: PresencePersonRow[]
  max: number
  size: 'sm' | 'md'
  label: string
}

const meta = {
  title: 'App/Collaboration/Avatar Stack',
  component: AvatarStack,
  tags: ['autodocs'],
  args: { people: room, max: 3, size: 'sm', label: 'In this room: Dana, Ana, Ben' },
  render: (args) => ({
    components: { AvatarStack },
    setup: () => ({ args }),
    template: '<div class="bg-panel p-4"><AvatarStack v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Room: Story = {}

export const Large: Story = {
  args: { size: 'md' }
}

export const MoreThanFit: Story = {
  args: { max: 2 }
}

export const Alone: Story = {
  args: { people: room.slice(0, 1), label: 'In this room: Dana' }
}
