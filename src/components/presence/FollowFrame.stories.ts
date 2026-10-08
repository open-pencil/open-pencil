import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { FollowedLabel } from '@/app/presence/registry'

import FollowFrame from './FollowFrame.vue'

const ana = { r: 0.92, g: 0.34, b: 0.29, a: 1 }

type Args = { followed: FollowedLabel; onStop: () => void }

const meta = {
  title: 'App/Collaboration/Follow Frame',
  component: FollowFrame,
  args: { followed: { kind: 'person', name: 'Ana', color: ana }, onStop: fn() },
  render: (args) => ({
    components: { FollowFrame },
    setup: () => ({ args }),
    template: '<div class="relative h-64 w-[480px] bg-canvas"><FollowFrame v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<Meta<Args>>

export const FollowingAPerson: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Following Ana')
    await userEvent.click(canvas.getByRole('button', { name: 'Stop following' }))
    await expect(args.onStop).toHaveBeenCalledOnce()
  }
}

export const FollowingTheirAgent: Story = {
  args: { followed: { kind: 'agent', name: 'Orbit', owner: 'Ana', color: ana } }
}
