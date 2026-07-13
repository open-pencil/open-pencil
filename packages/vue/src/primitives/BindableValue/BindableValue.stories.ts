import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import BindableValueDemo from './demo/BindableValueDemo.vue'

const meta = {
  title: 'Vue SDK/Primitives/BindableValue',
  component: BindableValueDemo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Provider-driven binding state, policies, picker composition, and NumberField integration.'
      }
    }
  }
} satisfies Meta<typeof BindableValueDemo>

export default meta
type Story = StoryObj<typeof meta>

export const StateMatrix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const detach = canvas.getByLabelText('Detach bound value')
    const readonly = canvas.getByLabelText('Readonly bound value')

    await expect(detach).toHaveAttribute('data-bound')
    await expect(readonly).toHaveAttribute('data-bound')
    await expect(canvas.getByLabelText('Mixed binding value')).toHaveAttribute('data-mixed')

    await userEvent.click(detach)
    const input = canvas.getByRole('spinbutton', { name: 'Detach bound value' })
    await userEvent.clear(input)
    await userEvent.type(input, '32{Enter}')
    await expect(detach).toHaveAttribute('data-unbound')
    await expect(detach).toHaveAttribute('aria-valuenow', '32')

    const editVariable = canvas.getByLabelText('Edit bound variable')
    await userEvent.click(editVariable)
    const variableInput = canvas.getByRole('spinbutton', { name: 'Edit bound variable' })
    await userEvent.clear(variableInput)
    await userEvent.type(variableInput, '40{Enter}')
    await expect(editVariable).toHaveAttribute('data-bound')
    await expect(editVariable).toHaveAttribute('aria-valuenow', '40')

    await userEvent.click(readonly)
    await expect(canvasElement.querySelectorAll('input')).toHaveLength(0)

    await userEvent.click(canvas.getByRole('button', { name: 'Choose binding' }))
    await expect(canvas.getByRole('button', { name: 'Space/md' })).toBeVisible()
  }
}
