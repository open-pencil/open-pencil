import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import NumberFieldDemo from './demo/NumberFieldDemo.vue'

const meta = {
  title: 'Vue SDK/Primitives/NumberField',
  component: NumberFieldDemo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Shared NumberField documentation demo covering anatomy, expressions, mixed values, disabled state, and bound state.'
      }
    }
  }
} satisfies Meta<typeof NumberFieldDemo>

export default meta
type Story = StoryObj<typeof meta>

export const StateMatrix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const root = canvas.getByLabelText('Interactive number field')

    await expect(root).toHaveStyle({ height: '26px' })
    await userEvent.click(root)
    const input = canvasElement.querySelector<HTMLInputElement>(
      '[data-test-id="interactive-number-input"]'
    )
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
    await userEvent.click(canvas.getByLabelText('Interactive number field'))
    await expect(
      canvasElement.querySelector('[data-test-id="interactive-number-input"]')
    ).toBeVisible()
  }
}
