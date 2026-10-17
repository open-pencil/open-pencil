import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { invalidateFontStalePictures } from '#core/editor/pages'

/**
 * Records the invalidation a renderer is asked for, which is the decision under test. It has no
 * `invalidateAllPictures`, so a wholesale drop cannot happen here without failing loudly.
 */
function recordingRenderer() {
  const invalidatedNodes: string[] = []
  const calls = { scenePicture: 0, structure: 0 }
  return {
    invalidatedNodes,
    calls,
    renderer: {
      invalidateNodePicture: (nodeId: string) => invalidatedNodes.push(nodeId),
      invalidateScenePicture: () => {
        calls.scenePicture += 1
      },
      tiledScene: {
        invalidateStructure: () => {
          calls.structure += 1
        }
      }
    }
  }
}

/** A page holding a font's text next to paints a font cannot change. */
function pageWithMixedPaints(): { text: SceneNode; others: SceneNode[] } {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected a default page')
  const text = graph.createNode('TEXT', page.id, {
    text: 'Loading',
    fontFamily: 'Loader Test',
    fontWeight: 400
  })
  const others = [
    graph.createNode('RECTANGLE', page.id, { width: 10, height: 10 }),
    graph.createNode('VECTOR', page.id, { width: 10, height: 10 }),
    graph.createNode('RECTANGLE', page.id, {
      width: 10,
      height: 10,
      fills: [
        {
          type: 'IMAGE',
          visible: true,
          opacity: 1,
          color: { r: 0, g: 0, b: 0, a: 1 },
          imageHash: 'hash'
        }
      ]
    })
  ]
  return { text, others }
}

function nodesOf(text: SceneNode, others: SceneNode[]): SceneNode[] {
  return [text, ...others]
}

describe('dropping the pictures a new font makes stale', () => {
  test('drops the text pictures, which the font changed', () => {
    const { renderer, invalidatedNodes } = recordingRenderer()
    const { text, others } = pageWithMixedPaints()

    invalidateFontStalePictures(renderer, nodesOf(text, others))

    expect(invalidatedNodes).toEqual([text.id])
  })

  test('asks the canvas to repaint, since the pictures it shows are new', () => {
    const { renderer, calls } = recordingRenderer()
    const { text, others } = pageWithMixedPaints()

    invalidateFontStalePictures(renderer, nodesOf(text, others))

    expect(calls.scenePicture).toBeGreaterThan(0)
    expect(calls.structure).toBeGreaterThan(0)
  })

  test('drops nothing when the page holds no text', () => {
    const { renderer, invalidatedNodes } = recordingRenderer()
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected a default page')
    const rectangle = graph.createNode('RECTANGLE', page.id, { width: 10, height: 10 })

    invalidateFontStalePictures(renderer, [rectangle])

    expect(invalidatedNodes).toEqual([])
  })
})
