import { describe, expect, test } from 'bun:test'

import { createLibraryRevision, materializeLibraryAsset } from '@open-pencil/core/library'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

const STROKE_IMAGE = 'stroke-image'
const POSTER = 'video-poster'

function paint(type: Fill['type'], imageHash: string): Fill {
  return { type, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, imageHash }
}

function libraryWithDrawnImages() {
  const graph = new SceneGraph()
  graph.images.set(STROKE_IMAGE, new Uint8Array([1]))
  graph.images.set(POSTER, new Uint8Array([2]))
  const badge = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Badge',
    componentKey: 'badge'
  })
  graph.createNode('RECTANGLE', badge.id, {
    fills: [{ ...paint('VIDEO', POSTER), videoHash: 'a'.repeat(40) }],
    strokes: [{ ...paint('IMAGE', STROKE_IMAGE), weight: 2, align: 'INSIDE' }]
  })
  return graph
}

describe('a library component with a stroke image and a video fill', () => {
  test('carries both images into the revision and into the file that inserts it', async () => {
    const revision = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: libraryWithDrawnImages()
    })
    expect([...revision.graph.images.keys()].sort()).toEqual([STROKE_IMAGE, POSTER].sort())

    const consumer = new SceneGraph()
    materializeLibraryAsset(consumer, revision, 'badge')
    expect([...consumer.images.keys()].sort()).toEqual([STROKE_IMAGE, POSTER].sort())
  })
})
