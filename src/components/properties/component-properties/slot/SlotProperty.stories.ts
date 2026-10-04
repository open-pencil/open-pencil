import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import SlotSettings from './examples/Settings.vue'
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

/** The row of the named slot and the document body its popovers open in. */
function slotRow(canvasElement: HTMLElement, name: string) {
  const row = within(canvasElement).getByText(name).closest('[data-panel-field-group]')
  if (!(row instanceof HTMLElement)) throw new Error(`Missing ${name} slot`)
  return { row: within(row), page: within(canvasElement.ownerDocument.body) }
}

export const LimitsPopover: Story = {
  play: async ({ canvasElement }) => {
    const { row, page } = slotRow(canvasElement, 'Items')
    await userEvent.click(row.getByText('3 limits'))
    await waitFor(() => expect(page.getByText('At most 3 layers')).toBeVisible())
    await waitFor(() => expect(page.getByText('1 layer is not preferred')).toBeVisible())
  }
}

export const AddInstances: Story = {
  play: async ({ canvasElement }) => {
    const { row, page } = slotRow(canvasElement, 'Body')
    await userEvent.click(row.getByRole('button', { name: 'Add instances' }))
    await waitFor(() => expect(page.getByText('Preferred')).toBeVisible())
    await waitFor(() => expect(page.getByText('Avatar')).toBeVisible())
  }
}

export const AddPreferredOnly: Story = {
  play: async ({ canvasElement }) => {
    const { row, page } = slotRow(canvasElement, 'Items')
    await userEvent.click(row.getByRole('button', { name: 'Add instances' }))
    await waitFor(() => expect(page.getByText('List item')).toBeVisible())
    await expect(page.queryByText('Avatar')).toBeNull()
  }
}

export const Settings: Story = {
  render: () => ({ components: { SlotSettings }, template: '<SlotSettings />' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Slot settings' }))
    const maximum = await page.findByLabelText('Maximum layers')
    await userEvent.clear(maximum)
    await userEvent.type(maximum, '5')
    await userEvent.tab()
    await expect(canvas.getByText('limits: 1..5')).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Add preferred instances' }))
    await userEvent.click(await page.findByRole('option', { name: /Divider/ }))
    await expect(canvas.getByText('prefer divider')).toBeVisible()
  }
}
