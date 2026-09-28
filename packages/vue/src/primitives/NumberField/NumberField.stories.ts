import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import NumberFieldStates from './examples/States.vue'

const meta = {
  title: 'Vue SDK/Primitives/NumberField',
  component: NumberFieldStates,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Shared NumberField documentation demo covering anatomy, expressions, mixed values, disabled state, and bound state.'
      }
    }
  }
} satisfies Meta<typeof NumberFieldStates>

export default meta
type Story = StoryObj<typeof meta>

export const StateMatrix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const root = canvas.getByLabelText('Interactive number field')

    await expect(root).toHaveStyle({ height: '26px' })
    await userEvent.click(root)
    const input = root.querySelector('input')
    if (!input) throw new Error('Expected the editing NumberField input')
    await userEvent.clear(input)
    await userEvent.type(input, '12*8+4{Enter}')
    await expect(root).toHaveAttribute('aria-valuenow', '100')

    await expect(canvas.getByLabelText('Mixed number field')).toHaveAttribute('data-mixed')
    await expect(canvas.getByLabelText('Disabled number field')).toHaveAttribute('data-disabled')
    await expect(canvas.getByLabelText('Bound number field')).toHaveAttribute('data-bound')
  }
}

export const Editing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const root = canvas.getByLabelText('Interactive number field')
    await userEvent.click(root)
    await expect(root.querySelector('input')).toBeVisible()
  }
}
