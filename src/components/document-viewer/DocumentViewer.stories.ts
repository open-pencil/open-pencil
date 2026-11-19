import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { onScopeDispose, shallowRef } from 'vue'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import DocumentViewer from './DocumentViewer.vue'

const meta = {
  title: 'App/Metrics/Document Viewer',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** A small document of two pages with a few framed shapes, as a reported file might be. */
async function sampleDocumentURL(): Promise<string> {
  const graph = new SceneGraph()
  const [first] = graph.getPages()
  const second = graph.addPage('Second page')
  for (const [page, color] of [
    [first, '#7c3aed'],
    [second, '#0ea5e9']
  ] as const) {
    const frame = graph.createNode('FRAME', page.id, { name: 'Card', width: 320, height: 200 })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Swatch',
      x: 24,
      y: 24,
      width: 120,
      height: 120,
      fills: [{ type: 'SOLID', color: parseColor(color), opacity: 1, visible: true }]
    })
  }
  const bytes = await exportFigFile(graph)
  return URL.createObjectURL(new Blob([Uint8Array.from(bytes)]))
}

/** A document open read-only: panning, zooming, and the page menu, nothing that edits. */
export const ReadOnly: Story = {
  render: () => ({
    components: { DocumentViewer },
    setup() {
      const url = shallowRef<string | null>(null)
      void sampleDocumentURL().then((created) => (url.value = created))
      onScopeDispose(() => {
        if (url.value) URL.revokeObjectURL(url.value)
      })
      return { url }
    },
    template: `<DocumentViewer v-if="url" :url="url" name="Sample.fig" />`
  })
}
