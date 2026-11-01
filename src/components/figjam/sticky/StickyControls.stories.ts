import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import type { FigJamTextSize } from '@open-pencil/scene-graph/figjam'
import { DEFAULT_STICKY_COLOR } from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'

import StickyControls from './StickyControls.vue'

const meta = {
  title: 'App/Editor/Properties/Sticky Note',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A selected sticky note's FigJam palette, body text size, and author line, as the Design panel shows them."
      }
    }
  },
  render: () => ({
    components: { StickyControls },
    setup() {
      const color = ref<Color>({ ...DEFAULT_STICKY_COLOR })
      const textSize = ref<FigJamTextSize>('small')
      const authorVisible = ref(true)
      return { color, textSize, authorVisible }
    },
    template: `
      <div class="w-[240px] bg-panel p-4">
        <StickyControls
          :color="color"
          :text-size="textSize"
          :author-visible="authorVisible"
          :typeface="null"
          @update:color="color = $event"
          @update:text-size="textSize = $event"
          @update:author-visible="authorVisible = $event"
        />
      </div>`
  })
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const PickColor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radio', { name: 'Blue' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await userEvent.click(canvas.getByRole('radio', { name: 'Yellow' }))
    await expect(canvas.getByRole('radio', { name: 'Yellow' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  }
}

export const HideAuthor: Story = {
  play: async ({ canvasElement }) => {
    const author = within(canvasElement).getByRole('switch', { name: 'Show author' })
    await userEvent.click(author)
    await expect(author).toHaveAttribute('aria-checked', 'false')
  }
}
