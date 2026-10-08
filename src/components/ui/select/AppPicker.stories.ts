import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import Picker from './examples/Picker.vue'

const meta = {
  title: 'Design System/Selection/Picker',
  component: Picker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A searchable, grouped list that opens beside the properties panel. Comfortable rows carry a thumbnail and a description; compact rows suit plain names such as variables; the grid shows thumbnails alone, naming the highlighted one in the footer.'
      }
    }
  }
} satisfies Meta<typeof Picker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Open the components picker and wait for its search field to take focus. */
async function openComponents(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const page = within(canvasElement.ownerDocument.body)
  await userEvent.click(canvas.getByRole('button', { name: 'Add instances' }))
  const search = await page.findByPlaceholderText('Search components')
  await waitFor(() => expect(search).toHaveFocus())
  return { canvas, page }
}

export const Components: Story = {
  play: async ({ canvasElement }) => {
    const { page } = await openComponents(canvasElement)
    await expect(page.getAllByText('Design system')).toHaveLength(2)
  }
}

export const KeyboardSearch: Story = {
  play: async ({ canvasElement }) => {
    const { canvas, page } = await openComponents(canvasElement)
    await userEvent.keyboard('butt')
    await expect(page.queryByText('Divider')).toBeNull()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(canvas.getByText(/^Chosen:/)).toHaveTextContent('Chosen: button'))
  }
}

export const CompactWithFooter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Apply variable' }))
    await waitFor(() =>
      expect(page.getByRole('button', { name: /Create number variable/ })).toBeVisible()
    )
  }
}

export const Grid: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Insert shape' }))
    const search = await page.findByPlaceholderText('Search shapes')
    await waitFor(() => expect(search).toHaveFocus())
    // The first shape is highlighted on opening; down moves a row of eight, to the ninth.
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(canvas.getByText(/^Chosen:/)).toHaveTextContent('Chosen: star'))
  }
}
