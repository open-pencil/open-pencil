import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

import { HEAVY_TEST_TIMEOUT_MS } from '#tests/helpers/test-utils'

/**
 * Regression: disabled numeric and caps features (PNUM, TNUM, LNUM, ONUM, FRAC, SMCP, …) are
 * absent from the schema's `OpenTypeFeature` enum, so emitting them as raw toggled tags made
 * `.fig` export throw `Invalid value "PNUM" for enum "OpenTypeFeature"`. Save and recovery
 * snapshots failed for any document using them.
 */
describe('OpenType feature encoding', () => {
  beforeAll(
    async () => {
      await initCodec()
    },
    { timeout: HEAVY_TEST_TIMEOUT_MS }
  )

  test(
    'exports and reimports text with disabled numeric features',
    { timeout: HEAVY_TEST_TIMEOUT_MS },
    async () => {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      graph.createNode('TEXT', page.id, {
        text: '1,111.00 / 8,888.00',
        fontFeatures: [
          { tag: 'TNUM', enabled: true },
          { tag: 'PNUM', enabled: false },
          { tag: 'SMCP', enabled: false },
          // A tag with no Kiwi representation at all must not poison the export either.
          { tag: 'ZZZZ', enabled: true }
        ]
      })

      const exported = await exportFigFile(graph)
      expect(exported.length).toBeGreaterThan(100)

      const reimported = await parseFigFile(
        exported.buffer.slice(
          exported.byteOffset,
          exported.byteOffset + exported.byteLength
        ) as ArrayBuffer
      )
      const text = [...reimported.getAllNodes()].find((node) => node.type === 'TEXT')
      // The numeric axis survives; the unencodable tags and cleared caps axis do not.
      expect(text?.fontFeatures).toEqual([
        { tag: 'LIGA', enabled: true },
        { tag: 'CALT', enabled: true },
        { tag: 'TNUM', enabled: true }
      ])
    }
  )
})
