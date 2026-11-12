import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import ColorFillStates from './examples/States.vue'

const meta = {
  title: 'Vue SDK/Primitives/Color and Fill',
  component: ColorFillStates,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Fill state, swatches for plain and bound values, and the temporary scalar channel slider for OkHCL controls.'
      }
    }
  }
} satisfies Meta<typeof ColorFillStates>

export default meta
type Story = StoryObj<typeof meta>

export const StateMatrix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Transparent fill' })).toHaveAttribute(
      'data-transparent'
    )
    const background = (name: string) =>
      canvas
        .getByRole('img', { name })
        .style.getPropertyValue('--open-pencil-fill-swatch-background')
    await expect(canvas.getByRole('img', { name: 'Bound token fill' })).toHaveAttribute(
      'data-bound'
    )
    await expect(background('Bound token fill')).not.toBe(background('Solid fill'))
    // A swatch inside a bound field, such as a variable picker's row, shows the fill it is given.
    await expect(canvas.getByRole('img', { name: 'Picker row fill' })).not.toHaveAttribute(
      'data-bound'
    )
    await expect(background('Picker row fill')).toBe(background('Solid fill'))

    await userEvent.click(canvas.getByRole('button', { name: 'Gradient' }))
    await expect(canvas.getByRole('img', { name: 'Editable fill' })).toHaveAttribute(
      'data-fill-category',
      'GRADIENT'
    )

    const slider = canvas.getByRole('slider', { name: 'Chroma' })
    await userEvent.click(slider)
    await userEvent.keyboard('{End}')
    await expect(slider).toHaveAttribute('aria-valuenow', '0.4')
    await userEvent.keyboard('{Home}')
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
  }
}
