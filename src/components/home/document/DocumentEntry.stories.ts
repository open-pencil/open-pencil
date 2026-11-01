import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref, type Directive } from 'vue'

import DocumentEntry from './DocumentEntry.vue'

const meta = {
  title: 'App/Home/Document Entry',
  component: DocumentEntry,
  args: { name: 'Design system', metadata: 'Sep 7, 2026', view: 'grid' },
  render: (args) => ({
    components: { DocumentEntry },
    setup: () => ({ args }),
    template:
      '<div class="max-w-sm bg-panel p-4 text-surface"><DocumentEntry v-bind="args" /></div>'
  })
} satisfies Meta<{
  name: string
  metadata: string
  view: 'grid' | 'list'
  disabled?: boolean
  previewURL?: string
  menu?: { actions: string; delete: string }
}>

export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const List: Story = { args: { view: 'list' } }
export const LongName: Story = {
  args: { name: 'A deliberately long document name that must stay inside the document card' }
}
export const Disabled: Story = { args: { disabled: true } }
const menu = { actions: 'Actions for Design system', delete: 'Delete' }
export const WithMenu: Story = { args: { menu } }
export const ListWithMenu: Story = { args: { view: 'list', menu } }

/** A 16×9 indigo PNG, so a story shows a preview without a server. */
const PREVIEW_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAFElEQVR4nGNITvtIEmIY1TAoNAAA5CT4oTrOkfMAAAAASUVORK5CYII='

/** A parent's directive reaches the entry's element, as Home's preview directives must. */
const markLoaded: Directive<HTMLElement> = {
  mounted(element) {
    element.dataset.previewRequested = 'true'
  }
}
export const WithMenuAndDirective: Story = {
  args: { menu, previewURL: PREVIEW_URL },
  render: (args) => ({
    components: { DocumentEntry },
    directives: { markLoaded },
    setup: () => ({ args, deleted: ref(false) }),
    template:
      '<div class="max-w-sm bg-panel p-4 text-surface" :data-deleted="deleted"><DocumentEntry v-mark-loaded v-bind="args" @delete="deleted = true" /></div>'
  })
}
