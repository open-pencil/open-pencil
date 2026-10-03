import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import SlotPropertyStates from './examples/States.vue'

const meta = {
  title: 'Editor/Properties/Slot Property',
  component: SlotPropertyStates,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Slot properties of a selected instance: default and modified content, item counts, slot limits, and Add instances.'
      }
    }
  }
} satisfies Meta<typeof SlotPropertyStates>

export default meta
type Story = StoryObj<typeof meta>

export const Rows: Story = {}

export const LimitsPopover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const items = canvas.getByText('Items').closest('[data-panel-field-group]')
    if (!(items instanceof HTMLElement)) throw new Error('Missing Items slot')
    await userEvent.click(within(items).getByText('3 limits'))
    await expect(page.getByText('At most 3 layers')).toBeVisible()
    await expect(page.getByText('1 layer is not preferred')).toBeVisible()
  }
}

export const AddInstances: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const body = canvas.getByText('Body').closest('[data-panel-field-group]')
    if (!(body instanceof HTMLElement)) throw new Error('Missing Body slot')
    await userEvent.click(within(body).getByRole('button', { name: 'Add instances' }))
    await expect(page.getByText('Preferred')).toBeVisible()
    await expect(page.getByText('Avatar')).toBeVisible()
  }
}

export const AddPreferredOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const items = canvas.getByText('Items').closest('[data-panel-field-group]')
    if (!(items instanceof HTMLElement)) throw new Error('Missing Items slot')
    await userEvent.click(within(items).getByRole('button', { name: 'Add instances' }))
    await expect(page.getByText('List item')).toBeVisible()
    await expect(page.queryByText('Avatar')).toBeNull()
  }
}
