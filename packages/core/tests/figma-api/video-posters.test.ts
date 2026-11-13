import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'

/** What every scene paint holds beside the fields of its type. */
const SCENE_PAINT = { color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
const HASH = 'a'.repeat(40)

function api() {
  const graph = new SceneGraph()
  return { graph, figma: new FigmaAPI(graph) }
}

describe('a video paint poster frame', () => {
  test('names the clip, apart from the poster frame a .fig video draws', () => {
    const { graph, figma } = api()
    const rectangle = figma.createRectangle()
    const poster = 'b'.repeat(40)
    const video: Fill = {
      type: 'VIDEO',
      ...SCENE_PAINT,
      imageHash: poster,
      videoHash: HASH,
      imageScaleMode: 'FILL'
    }
    graph.updateNode(rectangle.id, {
      fills: [video],
      strokes: [{ ...video, weight: 1, align: 'INSIDE' }]
    })
    expect(rectangle.fills).toEqual([expect.objectContaining({ videoHash: HASH })])

    const halfVideo = {
      type: 'VIDEO' as const,
      videoHash: HASH,
      scaleMode: 'FILL' as const,
      opacity: 0.5
    }
    rectangle.fills = [halfVideo]
    rectangle.strokes = [halfVideo]

    const node = graph.getNode(rectangle.id)
    for (const paint of [node?.fills[0], node?.strokes[0]]) {
      expect(paint).toMatchObject({ imageHash: poster, videoHash: HASH, opacity: 0.5 })
    }
  })

  test('keeps the poster when a video paint moves to another layer', () => {
    const { graph, figma } = api()
    const source = figma.createRectangle()
    const target = figma.createEllipse()
    const poster = 'c'.repeat(40)
    const video: Fill = { type: 'VIDEO', ...SCENE_PAINT, imageHash: poster, videoHash: HASH }
    graph.updateNode(source.id, {
      fills: [video],
      strokes: [{ ...video, weight: 1, align: 'INSIDE' }]
    })

    target.fills = source.fills
    target.strokes = source.strokes

    const node = graph.getNode(target.id)
    for (const paint of [node?.fills[0], node?.strokes[0]]) {
      expect(paint).toMatchObject({ type: 'VIDEO', imageHash: poster, videoHash: HASH })
    }
  })

  test('leaves a clip no layer has a poster for without one', () => {
    const { graph, figma } = api()
    const rectangle = figma.createRectangle()
    rectangle.fills = [{ type: 'VIDEO', videoHash: HASH, scaleMode: 'FILL' }]
    expect(graph.getNode(rectangle.id)?.fills[0].imageHash).toBeUndefined()
  })

  // Live Figma: every paint of a clip draws that clip's one poster, and a pasted paint naming
  // another poster loses it, so a paint never keeps a poster of its own.
  test('gives every paint of a clip the poster that clip has', () => {
    const { graph, figma } = api()
    const poster = 'd'.repeat(40)
    const source = figma.createRectangle()
    graph.updateNode(source.id, {
      fills: [{ type: 'VIDEO', ...SCENE_PAINT, imageHash: poster, videoHash: HASH }]
    })
    const target = figma.createEllipse()

    const video = { type: 'VIDEO' as const, videoHash: HASH, scaleMode: 'FILL' as const }
    target.fills = [
      { type: 'SOLID', color: { r: 1, g: 0, b: 0 } },
      video,
      { ...video, opacity: 0.5 }
    ]

    const posters = graph.getNode(target.id)?.fills.map((paint) => paint.imageHash)
    expect(posters).toEqual([undefined, poster, poster])
  })

  test('finds a poster only a vector region holds', () => {
    const { graph, figma } = api()
    const poster = 'a1'.repeat(20)
    graph.createNode('VECTOR', graph.getPages()[0].id, {
      fills: [],
      vectorNetwork: {
        vertices: [],
        segments: [],
        regions: [
          {
            windingRule: 'NONZERO',
            loops: [],
            fills: [{ type: 'VIDEO', ...SCENE_PAINT, imageHash: poster, videoHash: HASH }]
          }
        ]
      }
    })
    const rectangle = figma.createRectangle()

    rectangle.fills = [{ type: 'VIDEO', videoHash: HASH, scaleMode: 'FILL' }]

    expect(graph.getNode(rectangle.id)?.fills[0].imageHash).toBe(poster)
  })

  test('finds a poster only a text range holds', () => {
    const { graph, figma } = api()
    const poster = 'b2'.repeat(20)
    graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'clip',
      styleRuns: [
        {
          start: 0,
          length: 4,
          style: { fills: [{ type: 'VIDEO', ...SCENE_PAINT, imageHash: poster, videoHash: HASH }] }
        }
      ]
    })
    const rectangle = figma.createRectangle()

    rectangle.fills = [{ type: 'VIDEO', videoHash: HASH, scaleMode: 'FILL' }]

    expect(graph.getNode(rectangle.id)?.fills[0].imageHash).toBe(poster)
  })

  test('keeps the poster when a script writes a text range back', () => {
    const { graph, figma } = api()
    const poster = 'c3'.repeat(20)
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'clip',
      styleRuns: [
        {
          start: 0,
          length: 4,
          style: { fills: [{ type: 'VIDEO', ...SCENE_PAINT, imageHash: poster, videoHash: HASH }] }
        }
      ]
    })

    figma
      .getNodeById(node.id)
      ?.setRangeFills(0, 2, [{ type: 'VIDEO', videoHash: HASH, scaleMode: 'FILL', opacity: 0.5 }])

    const [run] = graph.getNode(node.id)?.styleRuns ?? []
    expect(run?.style.fills?.[0]).toMatchObject({ imageHash: poster, opacity: 0.5 })
  })

  test('finds a poster for a text range only another layer holds', () => {
    const { graph, figma } = api()
    const poster = 'd4'.repeat(20)
    const rectangle = figma.createRectangle()
    graph.updateNode(rectangle.id, {
      fills: [{ type: 'VIDEO', ...SCENE_PAINT, imageHash: poster, videoHash: HASH }]
    })
    const node = graph.createNode('TEXT', graph.getPages()[0].id, { text: 'clip' })

    figma
      .getNodeById(node.id)
      ?.setRangeFills(0, 4, [{ type: 'VIDEO', videoHash: HASH, scaleMode: 'FILL' }])

    const [run] = graph.getNode(node.id)?.styleRuns ?? []
    expect(run?.style.fills?.[0]?.imageHash).toBe(poster)
  })

  test('keeps the poster when a script writes a vector region back', () => {
    const { graph, figma } = api()
    const poster = 'e5'.repeat(20)
    const vector = figma.createVector()
    vector.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L 20 0 L 20 20 Z' }]
    const network = graph.getNode(vector.id)?.vectorNetwork
    graph.updateNode(vector.id, {
      vectorNetwork: network && {
        ...network,
        regions: network.regions.map((region) => ({
          ...region,
          fills: [{ type: 'VIDEO', ...SCENE_PAINT, imageHash: poster, videoHash: HASH }]
        }))
      }
    })

    vector.vectorNetwork = {
      ...vector.vectorNetwork,
      regions: vector.vectorNetwork.regions?.map((region) => ({
        ...region,
        fills: [{ type: 'VIDEO', videoHash: HASH, scaleMode: 'FILL', opacity: 0.5 }]
      }))
    }

    const [region] = graph.getNode(vector.id)?.vectorNetwork?.regions ?? []
    expect(region?.fills?.[0]).toMatchObject({ imageHash: poster, opacity: 0.5 })
  })

  test('keeps the poster when a script writes a paint style back', () => {
    const { graph, figma } = api()
    const style = figma.createPaintStyle()
    const styleNode = () =>
      [...graph.nodes.values()].find((node) => node.source.id === style.id && node.sharedStyleType)
    const poster = 'f'.repeat(40)
    graph.updateNode(styleNode()?.id ?? '', {
      fills: [{ type: 'VIDEO', ...SCENE_PAINT, imageHash: poster, videoHash: HASH }]
    })

    style.paints = style.paints.map((paint) => ({ ...paint, opacity: 0.5 }))

    expect(styleNode()?.fills[0]).toMatchObject({ imageHash: poster, opacity: 0.5 })
  })
})
