import { createDocumentGraph } from '@open-pencil/core'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { prepareGraphFonts } from '@open-pencil/core/text'

import { withMeasuredText, withMeasuringRenderer } from '../build'
import { createDeck } from './slides'

/** The deck as `.deck` bytes, as the gallery publishes it. */
export async function buildDemoDeck(): Promise<Uint8Array> {
  return withMeasuringRenderer((renderer) =>
    withMeasuredText(renderer, async () => {
      // A deck as the app makes one.
      const graph = createDocumentGraph('slides', 'light')
      const [page] = graph.getPages()
      await createDeck(graph, page.id)
      await prepareGraphFonts(graph, [page.id])
      computeAllLayouts(graph, page.id)
      return exportFigFile(graph, { ck: renderer.ck, renderer })
    })
  )
}
