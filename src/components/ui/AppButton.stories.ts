import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppButton from './AppButton.vue'

type AppButtonStoryArgs = {
  color: 'neutral' | 'primary' | 'error'
  variant: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  size: 'xs' | 'sm' | 'md' | 'lg'
  shape: 'square' | 'rounded' | 'pill'
  disabled: boolean
  loading: boolean
}

type Story = StoryObj<AppButtonStoryArgs>

const meta = {
  title: 'Design System/Button',
  component: AppButton,
  args: {
    color: 'neutral',
    variant: 'ghost',
    size: 'sm',
    shape: 'rounded',
    disabled: false,
    loading: false
  },
  render: (args) => ({
    components: { AppButton },
    setup: () => ({ args }),
    template: `
      <div class="flex min-h-40 flex-wrap items-center gap-3 bg-app p-6 text-surface">
        <AppButton v-bind="args">
          <template #leading><icon-lucide-copy /></template>
          Copy diagnostics
        </AppButton>
        <AppButton v-bind="args" variant="solid" color="primary">Primary action</AppButton>
        <AppButton v-bind="args" color="error">
          <template #leading><icon-lucide-trash-2 /></template>
          Clear
        </AppButton>
      </div>
    `
  })
} satisfies Meta<AppButtonStoryArgs>

export default meta

export const Default: Story = {}
export const Solid: Story = { args: { color: 'primary', variant: 'solid' } }
export const Outline: Story = { args: { color: 'neutral', variant: 'outline' } }
export const Error: Story = { args: { color: 'error', variant: 'ghost' } }
export const Link: Story = { args: { color: 'primary', variant: 'link' } }
export const Disabled: Story = { args: { disabled: true } }
export const Loading: Story = { args: { loading: true } }
export const Sizes: Story = {
  render: () => ({
    components: { AppButton },
    template: `
      <div class="flex items-center gap-3 bg-app p-6 text-surface">
        <AppButton size="xs">Extra small</AppButton>
        <AppButton size="sm">Small</AppButton>
        <AppButton size="md">Medium</AppButton>
        <AppButton size="lg">Large</AppButton>
      </div>
    `
  })
}
