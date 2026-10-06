import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import BehaviourStates from './examples/States.vue'

const meta = {
  title: 'Editor/Properties/Behaviour',
  component: BehaviourStates,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The behaviour of a main component: the control it acts as in preview, the properties that hold its values, and the layers that are its parts.'
      }
    }
  }
} satisfies Meta<typeof BehaviourStates>

export default meta
type Story = StoryObj<typeof meta>

export const States: Story = {}

export const AddBehaviour: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Add behaviour' }))
    await userEvent.click(await page.findByRole('option', { name: /Slider/ }))
    await waitFor(() => expect(canvas.getByText('add slider')).toBeVisible())
  }
}

export const MapState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Pressed state' }))
    await userEvent.click(await page.findByRole('option', { name: 'None' }))
    await waitFor(() => expect(canvas.getByText('pressed → default')).toBeVisible())
  }
}

export const CreateMissing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Still needed: Text.' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Add text layer' }))
    await waitFor(() => expect(canvas.getByText('create text Text for value')).toBeVisible())
  }
}
