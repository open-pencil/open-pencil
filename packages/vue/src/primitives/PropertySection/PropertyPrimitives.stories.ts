import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import PropertyPrimitivesDemo from './demo/PropertyPrimitivesDemo.vue'

const meta = {
  title: 'Vue SDK/Primitives/Property Primitives',
  component: PropertyPrimitivesDemo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Headless PropertySection, SegmentedControl, and typed PropertyList composition states.'
      }
    }
  }
} satisfies Meta<typeof PropertyPrimitivesDemo>

export default meta
type Story = StoryObj<typeof meta>

export const StateMatrix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const layer = canvas.getByRole('button', { name: 'Layer' })
    await expect(canvas.getByText('Collapsible content')).toBeVisible()
    await userEvent.click(layer)
    await expect(layer).toHaveAttribute('data-state', 'closed')

    await userEvent.click(canvas.getByRole('button', { name: 'Add first effect' }))
    await expect(canvas.getByText('Drop shadow')).toBeVisible()

    const center = canvas.getByRole('button', { name: 'center' })
    await userEvent.click(center)
    await expect(center).toHaveAttribute('data-state', 'on')
    await userEvent.keyboard('{ArrowRight}{Enter}')
    await expect(canvas.getByRole('button', { name: 'right' })).toHaveAttribute('data-state', 'on')

    await userEvent.click(canvas.getByRole('button', { name: 'rotate-90' }))
    await expect(canvas.getByText('Action: rotate-90')).toBeVisible()

    const hiddenItem = canvas.getByText('Fill 2').closest('[data-slot="item"]')
    await expect(hiddenItem).toHaveAttribute('data-hidden')
    await userEvent.click(canvas.getByRole('button', { name: 'Show' }))
    await expect(hiddenItem).not.toHaveAttribute('data-hidden')

    await userEvent.click(canvas.getByRole('button', { name: 'Add fill' }))
    await expect(canvas.getByText('Fill 3')).toBeVisible()
  }
}
