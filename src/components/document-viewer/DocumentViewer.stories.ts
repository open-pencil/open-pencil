import type { Meta, StoryObj } from '@storybook/vue3-vite'

import DocumentViewer from './DocumentViewer.vue'

const meta = {
  title: 'App/Metrics/Document Viewer',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The tour's document, open read-only: panning, zooming, and the page menu, nothing that edits. */
export const ReadOnly: Story = {
  render: () => ({
    components: { DocumentViewer },
    template: `<DocumentViewer url="/demo.fig" name="Demo.fig" />`
  })
}
