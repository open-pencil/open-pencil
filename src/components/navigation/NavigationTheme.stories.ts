import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import NavigationThemeDemo from './demo/NavigationThemeDemo.vue'

const meta = {
  title: 'Design System/Editor/Navigation',
  component: NavigationThemeDemo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Page list, Layers/Assets segmented tabs, and document TabBar theme states.'
      }
    }
  }
} satisfies Meta<typeof NavigationThemeDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Active')).toHaveAttribute('data-active')
    await expect(canvas.getByLabelText('Dragging')).toHaveAttribute('data-dragging')
    await expect(canvas.getByLabelText('Drop before')).toHaveAttribute(
      'data-drop-position',
      'before'
    )
    await expect(canvas.getByLabelText('Active tab')).toHaveAttribute('data-active')
  }
}

export const Light: Story = {
  globals: { theme: 'light' }
}
