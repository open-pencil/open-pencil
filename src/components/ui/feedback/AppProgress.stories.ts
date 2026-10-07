import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppProgress from './AppProgress.vue'
import type { ProgressAmount, ProgressTone } from './progress'

type ProgressStoryArgs = {
  amount: ProgressAmount
  label?: string
  tone?: ProgressTone
}

const meta = {
  title: 'Design System/Progress',
  component: AppProgress,
  args: { amount: { value: 42, max: 100 }, label: '42% · 9.6 MiB of 22.9 MiB' },
  render: (args) => ({
    components: { AppProgress },
    setup: () => ({ args }),
    template: '<div class="w-72 bg-panel p-4"><AppProgress v-bind="args" /></div>'
  })
} satisfies Meta<ProgressStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Determinate: Story = {}

export const Indeterminate: Story = {
  args: { amount: {}, label: 'Installing…' }
}

export const OnColouredSurface: Story = {
  args: { tone: 'current' },
  render: (args) => ({
    components: { AppProgress },
    setup: () => ({ args }),
    template:
      '<div class="w-72 rounded-md bg-accent p-3 text-white"><AppProgress v-bind="args" /></div>'
  })
}
