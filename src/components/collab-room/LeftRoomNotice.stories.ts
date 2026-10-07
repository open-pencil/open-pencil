import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import LeftRoomNotice from './LeftRoomNotice.vue'

type Args = { onDismiss: () => void }

const meta = {
  title: 'App/Collaboration/Left Room Notice',
  component: LeftRoomNotice,
  tags: ['autodocs'],
  args: { onDismiss: fn() },
  render: (args) => ({
    components: { LeftRoomNotice },
    setup: () => ({ args }),
    template: '<div class="relative h-40 bg-canvas"><LeftRoomNotice v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Dismiss: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Dismiss' }))
    await expect(args.onDismiss).toHaveBeenCalledOnce()
  }
}
