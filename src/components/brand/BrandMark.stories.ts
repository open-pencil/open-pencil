import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BrandMark from './BrandMark.vue'
import type { BrandMarkProps } from './types'

const meta = {
  title: 'App/Brand/Mark',
  component: BrandMark,
  args: { variant: 'mark', appearance: 'light', class: 'size-32' }
} satisfies Meta<BrandMarkProps>

export default meta
type Story = StoryObj<BrandMarkProps>

export const Mark: Story = {}
export const Micro: Story = { args: { variant: 'micro', class: 'size-4' } }
export const Monochrome: Story = { args: { variant: 'mono' } }
export const AppIcon: Story = { args: { variant: 'app-icon' } }
export const AppIconDark: Story = {
  args: { variant: 'app-icon', appearance: 'dark' },
  render: (args) => ({
    components: { BrandMark },
    setup: () => ({ args }),
    template: '<div class="bg-neutral-800 p-8"><BrandMark v-bind="args" /></div>'
  })
}
export const Dark: Story = {
  args: { appearance: 'dark' },
  render: (args) => ({
    components: { BrandMark },
    setup: () => ({ args }),
    template: '<div class="bg-gray-950 p-8"><BrandMark v-bind="args" /></div>'
  })
}
