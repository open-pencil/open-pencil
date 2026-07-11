import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

describe('page background color round-trip', () => {
  test('backgroundColor set on the page survives export + reimport', async () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const color = { r: 0.1176, g: 0.1176, b: 0.1176, a: 1 } // #1E1E1E

    // Same write the editor's setPageColor performs
    graph.updateNode(page.id, {
      source: {
        ...page.source,
        fig: {
          ...page.source.fig,
          rawNodeFields: { ...page.source.fig.rawNodeFields, backgroundColor: { ...color } }
        }
      }
    })

    const bytes = await exportFigFile(graph)
    const reimported = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    )
    const reimportedPage = expectDefined(reimported.getPages()[0])
    const raw = reimportedPage.source.fig.rawNodeFields['backgroundColor'] as Color
    expect(raw).toBeDefined()
    expect(raw.r).toBeCloseTo(color.r, 4)
    expect(raw.g).toBeCloseTo(color.g, 4)
    expect(raw.b).toBeCloseTo(color.b, 4)
  })
})
