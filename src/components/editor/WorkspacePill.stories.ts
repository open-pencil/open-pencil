import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import Pill from './examples/Pill.vue'

const meta = {
  title: 'Editor/Workspace Pill',
  component: Pill,
  parameters: {
    docs: {
      description: {
        component:
          'The pill of the canvas-only layout. Hiding the UI shows the way back to the panels; preview says so, resets the controls, and leaves preview.'
      }
    }
  }
} satisfies Meta<typeof Pill>

export default meta
type Story = StoryObj<typeof meta>

export const States: Story = {}

export const ResetAndLeave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }))
    await userEvent.click(canvas.getByRole('button', { name: /Leave preview/ }))
    await waitFor(() => expect(canvas.getByText('leave')).toBeVisible())
  }
}
