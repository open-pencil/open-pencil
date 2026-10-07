import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import LayerTreeStateMatrix from './examples/States.vue'
import LayerTreeVirtualized from './examples/Virtualized.vue'

const meta = {
  title: 'App/Editor/Layer Tree',
  component: LayerTreeStateMatrix,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Layer Tree theme states for selection focus, visibility, locking, dragging, drop instructions, and rename.'
      }
    }
  }
} satisfies Meta<{ adjacent?: boolean }>

export default meta
type Story = StoryObj<{ adjacent?: boolean }>

export const Virtualized: Story = {
  render: () => ({
    components: { LayerTreeVirtualized },
    template: '<LayerTreeVirtualized />'
  })
}

export const AdjacentRows: Story = { args: { adjacent: true } }

export const StateMatrix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Each row's disclosure is named after its layer.
    const row = (name: string) =>
      canvas.getByRole('button', { name }).closest<HTMLElement>('[data-slot="row"]')
    await expect(row('Selected focused')).toHaveAttribute('data-focused')
    await expect(row('Selected unfocused')).toHaveAttribute('data-selected')
    await expect(row('Hidden')).toHaveAttribute('data-hidden')
    await expect(row('Dragging')).toHaveAttribute('data-dragging')
    await expect(row('Child drop')).toHaveAttribute('data-drop-position', 'child')
  }
}
