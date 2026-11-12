import { describe, expect, test } from 'bun:test'

import {
  EMPTY_EXPORT_RUNTIME,
  sceneNodeToKiwi,
  type FigNodeChangeExportRuntime
} from '#fig/node-change/index'

import { SceneGraph } from '@open-pencil/scene-graph'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

describe('exporting text', () => {
  // Recorded in Figma 126's clipboard: 150% line height as RAW 1.5, 10% letter spacing as PERCENT.
  test('writes percent lengths as Figma does, on the text and its ranges', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Hello',
      fontSize: 20,
      lineHeight: percentLength(150),
      letterSpacing: percentLength(10),
      styleRuns: [{ start: 0, length: 2, style: { lineHeight: pixelLength(30) } }]
    })
    const [change] = sceneNodeToKiwi(text, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    expect(change.lineHeight).toEqual({ value: 1.5, units: 'RAW' })
    expect(change.letterSpacing).toEqual({ value: 10, units: 'PERCENT' })
    expect(change.textData?.styleOverrideTable).toEqual([
      expect.objectContaining({ lineHeight: { value: 30, units: 'PIXELS' } })
    ])
  })

  test('writes text shaped by the runtime as derived text data', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'A',
      width: 20,
      height: 20,
      fontSize: 16
    })
    const blobs: Uint8Array[] = []
    const runtime: FigNodeChangeExportRuntime = {
      ...EMPTY_EXPORT_RUNTIME,
      shapeText: () => ({
        glyphs: [
          {
            commands: [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 8, y: 16 }, { type: 'Z' }],
            x: 0,
            y: 15,
            fontSize: 16,
            firstCharacter: 0,
            advance: 10
          }
        ],
        baselines: [
          {
            firstCharacter: 0,
            endCharacter: 1,
            position: { x: 0, y: 15 },
            width: 10,
            lineY: 0,
            lineHeight: 19,
            lineAscent: 15
          }
        ],
        logicalIndexToCharacterOffsetMap: [0]
      })
    }

    const [change] = sceneNodeToKiwi(
      text,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      blobs,
      {
        fontDigestMap: new Map([['Inter|Regular', new Uint8Array([1, 2, 3])]]),
        glyphBlobMap: new Map(),
        runtime
      }
    )

    expect(change.derivedTextData?.glyphs).toHaveLength(1)
    expect(change.derivedTextData?.baselines?.[0]?.position.y).toBe(15)
    expect(blobs).toHaveLength(1)
  })
})
