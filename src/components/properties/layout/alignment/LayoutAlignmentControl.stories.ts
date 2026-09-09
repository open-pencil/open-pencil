import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import type { LayoutAlign, LayoutCounterAlign } from '@open-pencil/scene-graph'

import LayoutAlignmentControl from './LayoutAlignmentControl.vue'

const positions = ['MIN', 'CENTER', 'MAX'] as const
const meta = {
  title: 'Editor/Properties/Layout Alignment',
  render: () => ({
    components: { LayoutAlignmentControl },
    setup() {
      const primary = ref<LayoutAlign>('MIN')
      const counter = ref<LayoutCounterAlign>('MIN')
      const cells = computed(() =>
        positions.flatMap((y, row) =>
          positions.map((x, column) => ({
            primary: x,
            counter: y,
            label: `${['Top', 'Middle', 'Bottom'][row]} ${['left', 'center', 'right'][column]}`,
            active: x === primary.value && y === counter.value
          }))
        )
      )
      function select(x: LayoutAlign, y: LayoutCounterAlign) {
        primary.value = x
        counter.value = y
      }
      return { cells, select }
    },
    template:
      '<div class="bg-panel p-4"><LayoutAlignmentControl label="Alignment" :cells="cells" @select="select" /></div>'
  })
} satisfies Meta
export default meta
export const Default: StoryObj<typeof meta> = {}
