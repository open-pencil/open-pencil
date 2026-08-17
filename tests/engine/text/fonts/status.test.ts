import { describe, expect, test } from 'bun:test'

import { FontManager, SceneGraph, documentFontStatus } from '@open-pencil/core'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

describe('documentFontStatus', () => {
  test('reports loaded faces and their source without false warnings', () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    manager.markLoaded('Inter', 'Regular', new ArrayBuffer(8), 'bundled')
    graph.createNode('TEXT', pageId(graph), {
      name: 'Title',
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400
    })

    expect(documentFontStatus(graph, pageId(graph), manager)).toEqual({
      faithful: true,
      faces: [
        {
          family: 'Inter',
          style: 'Regular',
          status: 'available',
          source: 'bundled',
          substituteFamily: null,
          nodeIds: [expect.any(String)],
          nodeNames: ['Title']
        }
      ],
      issues: []
    })
  })

  test('reports the active default-family substitution for missing faces', () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    manager.markLoaded('Inter', 'Regular', new ArrayBuffer(8), 'bundled')
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Unavailable label',
      text: 'Hello',
      fontFamily: 'Missing Sans',
      fontWeight: 400
    })

    const status = documentFontStatus(graph, pageId(graph), manager)

    expect(status.faithful).toBe(false)
    expect(status.issues).toEqual([
      {
        family: 'Missing Sans',
        style: 'Regular',
        status: 'substituted',
        source: null,
        substituteFamily: 'Inter',
        nodeIds: [node.id],
        nodeNames: ['Unavailable label']
      }
    ])
  })

  test('reports synthesized styles and style-run faces separately', () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    manager.markLoaded('Example Sans', 'Regular', new ArrayBuffer(8), 'local')
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Mixed text',
      text: 'Bold and serif',
      fontFamily: 'Example Sans',
      fontWeight: 700,
      styleRuns: [
        {
          start: 9,
          length: 5,
          style: { fontFamily: 'Missing Serif', fontWeight: 400 }
        }
      ]
    })

    const status = documentFontStatus(graph, pageId(graph), manager)

    expect(status.issues).toEqual([
      {
        family: 'Example Sans',
        style: 'Bold',
        status: 'substituted',
        source: null,
        substituteFamily: 'Example Sans',
        nodeIds: [node.id],
        nodeNames: ['Mixed text']
      },
      {
        family: 'Missing Serif',
        style: 'Regular',
        status: 'unresolved',
        source: null,
        substituteFamily: null,
        nodeIds: [node.id],
        nodeNames: ['Mixed text']
      }
    ])
  })
})
