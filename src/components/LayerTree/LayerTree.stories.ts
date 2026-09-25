import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import LayerTreeStateMatrix from './examples/States.vue'
import LayerTreeVirtualized from './examples/Virtualized.vue'

const meta = {
  title: 'Editor/Layer Tree',
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
    await expect(canvas.getByLabelText('Selected focused').firstElementChild).toHaveAttribute(
      'data-focused'
    )
    await expect(canvas.getByLabelText('Selected unfocused').firstElementChild).toHaveAttribute(
      'data-selected'
    )
    await expect(canvas.getByLabelText('Hidden').firstElementChild).toHaveAttribute('data-hidden')
    await expect(canvas.getByLabelText('Dragging').firstElementChild).toHaveAttribute(
      'data-dragging'
    )
    await expect(canvas.getByLabelText('Child drop').firstElementChild).toHaveAttribute(
      'data-drop-position',
      'child'
    )
  }
}
