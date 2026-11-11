import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill, type TextPathData } from '@open-pencil/scene-graph'
import { scaleNodeChanges } from '@open-pencil/scene-graph/scaling'

const pattern: Fill = {
  type: 'PATTERN',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  scale: 1,
  patternSpacing: { x: 4, y: 6 }
}

describe('scaling a vector', () => {
  test("scales a region's own paints as it scales the layer's", () => {
    const graph = new SceneGraph()
    const vector = graph.createNode('VECTOR', graph.getPages()[0].id, {
      width: 10,
      height: 10,
      fills: [pattern],
      vectorNetwork: {
        vertices: [{ x: 0, y: 0 }],
        segments: [],
        regions: [{ windingRule: 'NONZERO', loops: [], fills: [pattern] }]
      }
    })
    const changes = scaleNodeChanges(vector, 2, false)
    const [region] = changes.vectorNetwork?.regions ?? []
    expect(region?.fills).toEqual(changes.fills)
    expect(region?.fills?.[0]).toMatchObject({ scale: 2, patternSpacing: { x: 8, y: 12 } })
  })
})

describe('scaling text on a path', () => {
  const curve: TextPathData = {
    network: {
      vertices: [
        { x: 0, y: 100 },
        { x: 400, y: 100 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 100, y: -80 }, tangentEnd: { x: -100, y: -80 } }],
      regions: []
    },
    normalizedSize: { x: 400, y: 160 },
    tValue: 0,
    forward: true
  }

  function pathText(graph: SceneGraph) {
    return graph.createNode('TEXT', graph.getPages()[0].id, {
      width: 400,
      height: 160,
      text: 'Lorem',
      fontSize: 32,
      textPathData: structuredClone(curve),
      textPathBox: { x: 10, y: 20, width: 400, height: 160 },
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 30, y: 90, fontSize: 32, rotation: -0.4, advance: 18 },
        { commandsBlob: new Uint8Array(4), x: 50, y: 82, fontSize: 32, rotation: -0.3 }
      ]
    })
  }

  test('scales its glyphs and path box with the text and keeps the path', () => {
    const graph = new SceneGraph()
    const text = pathText(graph)

    graph.updateNode(text.id, scaleNodeChanges(text, 2, false))

    expect(text.textPathData).toEqual(curve)
    expect(text.textPathBox).toEqual({ x: 20, y: 40, width: 800, height: 320 })
    expect(text.derivedTextGlyphs).toMatchObject([
      { x: 60, y: 180, fontSize: 64, rotation: -0.4, advance: 36 },
      { x: 100, y: 164, fontSize: 64, rotation: -0.3 }
    ])
  })

  test('leaves flat text to drop its glyphs and lay out again', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      width: 400,
      height: 40,
      text: 'Lorem',
      fontSize: 32,
      derivedTextGlyphs: [{ commandsBlob: new Uint8Array(4), x: 0, y: 30, fontSize: 32 }]
    })

    expect(scaleNodeChanges(text, 2, false)).not.toHaveProperty('derivedTextGlyphs')
  })
})
