import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import type { ConnectorLineType, StrokeCap } from '@open-pencil/scene-graph'

import ConnectorControls from './ConnectorControls.vue'

const meta = {
  title: 'App/Editor/Properties/Connector',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A selected connector's line type and the caps at its ends, as the Design panel shows them."
      }
    }
  },
  render: () => ({
    components: { ConnectorControls },
    setup() {
      const lineType = ref<ConnectorLineType>('ELBOWED')
      const startCap = ref<StrokeCap>('NONE')
      const endCap = ref<StrokeCap>('ARROW_LINES')
      return { lineType, startCap, endCap }
    },
    template: `
      <div class="w-[240px] bg-panel p-4">
        <ConnectorControls
          :line-type="lineType"
          :start-cap="startCap"
          :end-cap="endCap"
          @update:line-type="lineType = $event"
          @update:start-cap="startCap = $event"
          @update:end-cap="endCap = $event"
        />
      </div>`
  })
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const PicksACap: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: 'End point' }))
    await userEvent.click(within(document.body).getByRole('option', { name: 'Circle arrow' }))
    await expect(canvas.getByRole('combobox', { name: 'End point' })).toHaveTextContent(
      'Circle arrow'
    )
  }
}
