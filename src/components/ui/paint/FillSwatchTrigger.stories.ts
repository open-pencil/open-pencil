import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'

import type { Fill } from '@open-pencil/scene-graph'

import FillSwatchTrigger from './FillSwatchTrigger.vue'

const fill: Fill = {
  type: 'SOLID',
  color: { r: 0.5, g: 0.25, b: 0.9, a: 1 },
  opacity: 1,
  visible: true
}

const meta = {
  title: 'Design System/Paint/Fill Swatch',
  component: FillSwatchTrigger,
  args: { fill, label: 'Fill' },
  render: (args) => ({
    components: { FillSwatchTrigger },
    setup: () => ({ args }),
    template: `
      <div class="flex items-center gap-4 bg-panel p-6">
        <FillSwatchTrigger v-bind="args" />
        <FillSwatchTrigger v-bind="args" size="md" label="Page background" />
        <FillSwatchTrigger v-bind="args" disabled label="Disabled fill" />
      </div>
    `
  })
} satisfies Meta<{ fill: Fill; label: string }>

export default meta
export const Default: StoryObj<typeof meta> = {}
export const Transparent: StoryObj<typeof meta> = {
  args: { fill: { ...fill, color: { ...fill.color, a: 0.35 } } }
}
export const Gradient: StoryObj<typeof meta> = {
  args: {
    fill: {
      ...fill,
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: fill.color },
        { position: 1, color: { r: 0.1, g: 0.8, b: 0.9, a: 1 } }
      ]
    }
  }
}
export const ImagePlaceholder: StoryObj<typeof meta> = {
  args: { fill: { ...fill, type: 'IMAGE', imageHash: 'unavailable-preview' } }
}
export const PopoverComposition: StoryObj<typeof meta> = {
  name: 'Picker Trigger',
  render: (args) => ({
    components: { FillSwatchTrigger, PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent },
    setup: () => ({ args }),
    template: `
      <div class="bg-panel p-6">
        <PopoverRoot>
          <PopoverTrigger as-child><FillSwatchTrigger v-bind="args" /></PopoverTrigger>
          <PopoverPortal><PopoverContent class="rounded border border-border bg-panel p-4 text-xs text-surface" :side-offset="8">Swatch trigger composition</PopoverContent></PopoverPortal>
        </PopoverRoot>
      </div>
    `
  })
}
