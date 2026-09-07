import type { Meta, StoryObj } from '@storybook/vue3-vite'

import DocumentEntry from './DocumentEntry.vue'

const meta = {
  title: 'Home/Document Entry',
  component: DocumentEntry,
  args: { name: 'Design system', metadata: 'Sep 7, 2026', view: 'grid' },
  render: (args) => ({
    components: { DocumentEntry },
    setup: () => ({ args }),
    template:
      '<div class="max-w-sm bg-panel p-4 text-surface"><DocumentEntry v-bind="args" /></div>'
  })
} satisfies Meta<{ name: string; metadata: string; view: 'grid' | 'list'; disabled?: boolean }>

export default meta
export const Default: StoryObj<typeof meta> = {}
export const List: StoryObj<typeof meta> = { args: { view: 'list' } }
export const LongName: StoryObj<typeof meta> = {
  args: { name: 'A deliberately long document name that must stay inside the document card' }
}
export const Disabled: StoryObj<typeof meta> = { args: { disabled: true } }
