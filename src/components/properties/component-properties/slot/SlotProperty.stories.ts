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
    await expect(page.getByText('At most 3 layers')).toBeVisible()
    await expect(page.getByText('1 layer is not preferred')).toBeVisible()
  }
}

export const AddInstances: Story = {
  play: async ({ canvasElement }) => {
    const { row, page } = slotRow(canvasElement, 'Body')
    await userEvent.click(row.getByRole('button', { name: 'Add instances' }))
    await expect(page.getByText('Preferred')).toBeVisible()
    await expect(page.getByText('Avatar')).toBeVisible()
  }
}

export const AddPreferredOnly: Story = {
  play: async ({ canvasElement }) => {
    const { row, page } = slotRow(canvasElement, 'Items')
    await userEvent.click(row.getByRole('button', { name: 'Add instances' }))
    await expect(page.getByText('List item')).toBeVisible()
    await expect(page.queryByText('Avatar')).toBeNull()
  }
}
