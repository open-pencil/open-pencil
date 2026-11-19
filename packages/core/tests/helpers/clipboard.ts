import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

export function createClipboardGraph(): { graph: SceneGraph; pageId: string } {
  const graph = new SceneGraph()
  graph.addPage('Test')
  return { graph, pageId: graph.rootId }
}

export const STROKE_IMAGE = 'stroke-image'
export const REGION_POSTER = 'region-poster'

export function vectorWithStrokeAndRegionImages(): { graph: SceneGraph; vector: SceneNode } {
  const graph = new SceneGraph()
  graph.images.set(STROKE_IMAGE, new Uint8Array([1]))
  graph.images.set(REGION_POSTER, new Uint8Array([2]))
  const paint = { color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
  const vector = graph.createNode('VECTOR', graph.getPages()[0].id, {
    fills: [],
    strokes: [{ ...paint, type: 'IMAGE', imageHash: STROKE_IMAGE, weight: 2, align: 'INSIDE' }],
    vectorNetwork: {
      vertices: [],
      segments: [],
      regions: [
        {
          windingRule: 'NONZERO',
          loops: [],
          fills: [{ ...paint, type: 'VIDEO', imageHash: REGION_POSTER, videoHash: 'a'.repeat(40) }]
        }
      ]
    }
  })
  return { graph, vector }
}
