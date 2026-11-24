import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('roundtrip: document color profile', () => {
  beforeAll(async () => {
    await initCodec()
  })

  for (const space of ['display-p3', 'srgb'] as const) {
    test(`a ${space} document opens in the profile it was saved in`, async () => {
      const graph = new SceneGraph()
      graph.documentColorSpace = space
      const reImported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
      expect(reImported.documentColorSpace).toBe(space)
    })
  }
})
