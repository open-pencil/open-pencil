import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import type {
  FigJamColorName,
  FigJamFillMode,
  FigJamLineStyle,
  FigJamTextSize,
  FigJamTypeface
} from '@open-pencil/scene-graph/figjam'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

import ShapeWithTextControls from './ShapeWithTextControls.vue'

const meta = {
  title: 'App/Editor/Properties/Shape With Text',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A selected shape with text's kind, FigJam palette fill and outline, see-through and dashed toggles, text size, and typeface, as the Design panel shows them."
      }
    }
  },
  render: () => ({
    components: { ShapeWithTextControls },
    setup() {
      const kind = ref<ShapeWithTextType>('DIAMOND')
      const color = ref<FigJamColorName | null>('yellow')
      const fillMode = ref<FigJamFillMode>('fill')
      const lineStyle = ref<FigJamLineStyle>('solid')
      const lineColor = ref<FigJamColorName | null>(null)
      const textSize = ref<FigJamTextSize>('small')
      const typeface = ref<FigJamTypeface>('simple')
      return { kind, color, fillMode, lineStyle, lineColor, textSize, typeface }
    },
    template: `
      <div class="w-[240px] bg-panel p-4">
        <ShapeWithTextControls
          :kind="kind"
          :color="color"
          :fill-mode="fillMode"
          :line-style="lineStyle"
          :line-color="lineColor"
          :text-size="textSize"
          :typeface="typeface"
          @update:kind="kind = $event"
          @update:color="color = $event; if (fillMode === 'none') fillMode = 'fill'"
          @update:fill-mode="fillMode = $event"
          @update:line-style="lineStyle = $event"
          @update:line-color="lineColor = $event"
          @update:text-size="textSize = $event"
          @update:typeface="typeface = $event"
        />
      </div>`
  })
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const PickColorsAndToggles: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const fill = within(canvas.getByRole('radiogroup', { name: 'Fill' }))
    await userEvent.click(fill.getByRole('radio', { name: 'Violet' }))
    await expect(fill.getByRole('radio', { name: 'Violet' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await userEvent.click(fill.getByRole('radio', { name: 'None' }))
    await expect(fill.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true')
    const dashed = canvas.getByRole('button', { name: 'Dashed' })
    await userEvent.click(dashed)
    await expect(dashed).toHaveAttribute('aria-pressed', 'true')
  }
}
