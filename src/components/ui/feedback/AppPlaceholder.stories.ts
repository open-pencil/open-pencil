import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppPlaceholder from './AppPlaceholder.vue'

type PlaceholderStoryArgs = {
  label: string
  description?: string
  fill?: boolean
  size: 'compact' | 'panel' | 'page'
}

const meta = {
  title: 'Design System/Placeholder',
  args: {
    label: 'No documents yet',
    description: 'Create a document to start working in this space.',
    size: 'panel'
  },
  render: (args) => ({
    components: { AppPlaceholder },
    setup: () => ({ args }),
    template: `
      <div class="flex h-72 w-full bg-app text-surface">
        <AppPlaceholder v-bind="args">
          <template #icon>
            <icon-lucide-files class="size-5" />
          </template>
          <template #action>
            <button type="button" class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white">
              Create document
            </button>
          </template>
        </AppPlaceholder>
      </div>
    `
  })
} satisfies Meta<PlaceholderStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Panel: Story = {}

export const Compact: Story = {
  args: {
    label: 'No results',
    description: undefined,
    fill: false,
    size: 'compact'
  }
}
