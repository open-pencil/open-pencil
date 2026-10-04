import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import ChatRunLocation from './ChatRunLocation.vue'

type Args = { agent: string; page: string; onOpen: () => void }

const meta = {
  title: 'Chat/Run Location',
  component: ChatRunLocation,
  tags: ['autodocs'],
  args: { agent: 'Fern', page: 'Checkout', onOpen: fn() },
  render: (args) => ({
    components: { ChatRunLocation },
    setup: () => ({ args }),
    template: '<div class="w-72 bg-panel"><ChatRunLocation v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const OnAnotherPage: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Fern is working on “Checkout”')
    await userEvent.click(canvas.getByRole('button', { name: 'Go to page' }))
    await expect(args.onOpen).toHaveBeenCalledOnce()
  }
}

export const LongPageName: Story = {
  args: { page: 'Onboarding flow — empty states, errors, and the long tail of edge cases' }
}
