import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CanvasRootExample from './examples/CanvasRootExample.vue'

const meta = {
  title: 'Vue SDK/Canvas/Canvas Root',
  component: CanvasRootExample,
  parameters: {
    docs: {
      description: {
        component:
          'CanvasRoot connects the injected editor to the CanvasSurface inside it and renders the current page with CanvasKit.'
      }
    }
  }
} satisfies Meta<typeof CanvasRootExample>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Draws without taking pointer input, as a thumbnail or a preview beside an editor does. */
export const DrawOnly: Story = {
  render: () => ({
    components: { CanvasRootExample },
    template: '<CanvasRootExample :input="false" />'
  })
}
