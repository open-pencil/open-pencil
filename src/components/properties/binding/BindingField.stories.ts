import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import BindingFieldDemo from './demo/BindingFieldDemo.vue'

const meta = {
  title: 'Design System/Properties/Binding Field',
  component: BindingFieldDemo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'App-private binding skins for quiet fields, variable identity pills, hover affordances, and the variable picker.'
      }
    }
  }
} satisfies Meta<typeof BindingFieldDemo>

export default meta
type Story = StoryObj<typeof meta>

export const StateMatrix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const controls = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-story-control]'))

    for (const control of controls) await expect(control).toHaveStyle({ height: '26px' })

    const detachField = canvas.getByLabelText('Detach bound field')
    await expect(detachField).toHaveAttribute('data-bound')

    await userEvent.click(detachField)
    const detachInput = canvas.getByRole('spinbutton', { name: 'Detach bound field' })
    await expect(detachInput).toBeVisible()
    await expect(detachField).toHaveAttribute('data-bound')

    await userEvent.clear(detachInput)
    await userEvent.type(detachInput, '32')
    await expect(detachField).toHaveAttribute('data-unbound')
    await userEvent.keyboard('{Escape}')
    await expect(canvas.getByLabelText('Detach bound field')).toHaveAttribute('data-bound')

    const unboundField = canvas.getByLabelText('Unbound field')
    const trigger = within(unboundField).getByRole('button', { name: 'Apply variable' })
    await userEvent.click(trigger)
    const search = page.getByPlaceholderText('Search variables')
    await expect(search).toBeVisible()
    await userEvent.type(search, 'lg')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(canvas.getByLabelText('Unbound field')).toHaveAttribute('data-bound')
  }
}
