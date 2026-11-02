import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ref } from 'vue'

import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

import { SHAPE_KIND_ICONS } from '@/components/icons/shapes'

import ShapeKindPicker from './ShapeKindPicker.vue'

const meta = {
  title: 'App/Editor/Shapes/Shape Kind Picker',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "FigJam's shape-with-text kinds as a searchable grid of their outlines, Basic then Flowchart, as the Shape tool and the Design panel offer them."
      }
    }
  },
  render: () => ({
    components: { ShapeKindPicker },
    setup() {
      const kind = ref<ShapeWithTextType>('DIAMOND')
      return { kind, icons: SHAPE_KIND_ICONS }
    },
    template: `
      <div class="flex h-[520px] items-end justify-center bg-canvas p-4">
        <ShapeKindPicker heading="Shape" tooltip="Shape" :selected="kind" @select="kind = $event">
          <template #trigger>
            <button type="button" aria-label="Shape" class="flex items-center gap-2 rounded-md bg-panel px-2 py-1 text-surface">
              <component :is="icons[kind]" class="size-5" />
              <span>{{ kind }}</span>
            </button>
          </template>
        </ShapeKindPicker>
      </div>`
  })
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

async function openPicker(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const page = within(canvasElement.ownerDocument.body)
  await userEvent.click(canvas.getByRole('button', { name: 'Shape' }))
  return { canvas, page }
}

export const PickKind: Story = {
  play: async ({ canvasElement }) => {
    const { canvas, page } = await openPicker(canvasElement)
    await expect(await page.findByText('Basic')).toBeVisible()
    await expect(page.getByText('Flowchart')).toBeVisible()
    await userEvent.click(page.getByRole('option', { name: 'Cylinder' }))
    await waitFor(() => expect(canvas.getByText('ENG_DATABASE')).toBeVisible())
  }
}

export const Search: Story = {
  play: async ({ canvasElement }) => {
    const { page } = await openPicker(canvasElement)
    await userEvent.keyboard('hexa')
    await waitFor(() => expect(page.queryByRole('option', { name: 'Square' })).toBeNull())
    await expect(page.getByRole('option', { name: 'Hexagon' })).toBeVisible()
  }
}
