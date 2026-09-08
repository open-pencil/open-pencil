import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppProgress from './AppProgress.vue'

type ProgressStoryArgs = {
  value: number
  max: number
  label: string
  size: 'sm' | 'md'
  tone: 'accent' | 'muted' | 'warning' | 'danger'
}

const meta = {
  title: 'Design System/Progress',
  args: {
    value: 42,
    max: 100,
    label: 'Example progress',
    size: 'sm',
    tone: 'accent'
  },
  render: (args) => ({
    components: { AppProgress },
    setup: () => ({ args }),
    template: '<div class="w-80 bg-panel p-4"><AppProgress v-bind="args" /></div>'
  })
} satisfies Meta<ProgressStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Warning: Story = { args: { value: 82, tone: 'warning' } }
export const OverMaximum: Story = { args: { value: 140, max: 100, tone: 'danger' } }
