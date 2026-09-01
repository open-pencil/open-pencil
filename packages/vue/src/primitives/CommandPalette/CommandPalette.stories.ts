import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import CommandPaletteDemo from './CommandPaletteDemo.vue'

const meta = {
  title: 'Vue SDK/Primitives/Command Palette',
  component: CommandPaletteDemo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Headless searchable command list built on Reka UI Listbox primitives.'
      }
    }
  }
} satisfies Meta<typeof CommandPaletteDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Interaction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('searchbox', { name: 'Search commands' })

    await userEvent.click(input)
    await userEvent.type(input, 'setting')
    await expect(canvas.getByRole('option', { name: /Settings/ })).toBeVisible()
    await expect(canvas.queryByRole('option', { name: 'Undo' })).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('option', { name: /Settings/ }))
    await expect(canvas.getByRole('status', { name: 'Last selection' })).toHaveTextContent(
      'Settings'
    )

    await userEvent.clear(input)
    await userEvent.click(canvas.getByRole('option', { name: 'Export selection' }))
    await expect(canvas.getByText('Export selection as PNG')).toBeVisible()
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}')
    await expect(canvas.getByRole('option', { name: 'Export selection' })).toBeVisible()
  }
}
