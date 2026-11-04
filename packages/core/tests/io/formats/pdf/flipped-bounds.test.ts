import { describe, expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'
import { flippedCases } from '#core-tests/helpers/flipped-layers'

import { exportPDFDocument } from '#core/io/formats/pdf'

describe('PDF pages of flipped layers', () => {
  for (const layer of flippedCases()) {
    test(`${layer.name} gets a page the size of everything it covers`, async () => {
      const spec = { pageId: layer.pageId, nodeIds: [layer.nodeId], label: layer.name }
      const result = expectDefined(
        await exportPDFDocument(layer.graph, [spec], { embedFonts: false })
      )
      const [page] = result.pages
      expect(page?.width).toBeCloseTo(layer.bounds.maxX - layer.bounds.minX, 1)
      expect(page?.height).toBeCloseTo(layer.bounds.maxY - layer.bounds.minY, 1)
    })
  }
})
