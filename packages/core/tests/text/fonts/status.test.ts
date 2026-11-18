import { describe, expect, test } from 'bun:test'

import {
  DocumentFontUses,
  FontManager,
  documentFontStatus,
  UnsupportedFontFormatError
} from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

describe('documentFontStatus', () => {
  test('reports loaded faces and their source without false warnings', async () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    await manager.markLoaded('Inter', 'Regular', new ArrayBuffer(8), 'bundled')
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
          name: 'Regular',
          status: 'available',
          source: 'bundled',
          substituteFamily: null,
          reason: null,
          nodeIds: [expect.any(String)],
          nodeNames: ['Title']
        }
      ],
      issues: []
    })
  })

  test('counts a root that is itself a text node', async () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    await manager.markLoaded('Inter', 'Regular', new ArrayBuffer(8), 'bundled')
    const node = graph.createNode('TEXT', pageId(graph), {
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400
    })

    const status = documentFontStatus(graph, [node.id], manager)
    expect(status.faces.map((face) => [face.family, face.style, face.status])).toEqual([
      ['Inter', 'Regular', 'available']
    ])
  })

  test('reports the active default-family substitution for missing faces', async () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    await manager.markLoaded('Inter', 'Regular', new ArrayBuffer(8), 'bundled')
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
        name: 'Regular',
        status: 'substituted',
        source: null,
        substituteFamily: 'Inter',
        reason: null,
        nodeIds: [node.id],
        nodeNames: ['Unavailable label']
      }
    ])
  })

  test('reports synthesized styles and style-run faces separately', async () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    await manager.markLoaded('Example Sans', 'Regular', new ArrayBuffer(8), 'local')
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
        name: 'Bold',
        status: 'substituted',
        source: null,
        substituteFamily: 'Example Sans',
        reason: null,
        nodeIds: [node.id],
        nodeNames: ['Mixed text']
      },
      {
        family: 'Missing Serif',
        style: 'Regular',
        name: 'Regular',
        status: 'unresolved',
        source: null,
        substituteFamily: null,
        reason: null,
        nodeIds: [node.id],
        nodeNames: ['Mixed text']
      }
    ])
  })

  test('reports why the host could not load an installed face until it loads', async () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    await manager.markLoaded('Inter', 'Regular', new ArrayBuffer(8), 'bundled')
    let host: 'unsupported' | 'failed' | 'drawable' = 'unsupported'
    manager.setHostFontLoader(async (family, style) => {
      if (host === 'unsupported') throw new UnsupportedFontFormatError(family, style)
      return host === 'drawable' ? new ArrayBuffer(8) : null
    })
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Chinese label',
      text: '按钮',
      fontFamily: 'PingFang SC',
      fontWeight: 400
    })

    expect(await manager.loadLocalFont('PingFang SC', 'Regular')).toBeNull()
    expect(documentFontStatus(graph, pageId(graph), manager).issues).toEqual([
      {
        family: 'PingFang SC',
        style: 'Regular',
        name: 'Regular',
        status: 'substituted',
        source: null,
        substituteFamily: 'Inter',
        reason: 'unsupported-format',
        nodeIds: [node.id],
        nodeNames: ['Chinese label']
      }
    ])

    host = 'failed'
    expect(await manager.loadLocalFont('PingFang SC', 'Regular')).toBeNull()
    expect(manager.unavailableReason('PingFang SC', 'Regular')).toBe('unsupported-format')

    host = 'drawable'
    expect(await manager.loadLocalFont('PingFang SC', 'Regular')).not.toBeNull()
    expect(documentFontStatus(graph, pageId(graph), manager).faithful).toBe(true)
  })

  test('names faces as their text does, and keeps two faces of one weight apart', () => {
    const graph = new SceneGraph()
    // As pasted from Figma: Avenir's Roman and Book are both weight 400.
    graph.createNode('TEXT', pageId(graph), {
      name: 'Mixed',
      text: 'Roman then Book then Bold',
      fontFamily: 'Avenir',
      fontStyle: 'Roman',
      styleRuns: [
        { start: 10, length: 4, style: { fontStyle: 'Book' } },
        // A range from HTML sets a weight and no name, so it takes no name of the text's.
        { start: 20, length: 5, style: { fontWeight: 700 } }
      ]
    })

    const issues = documentFontStatus(graph, pageId(graph), new FontManager()).issues
    // Faces their weight cannot pick load by their own names.
    expect(issues.map(({ name, style }) => [name, style])).toEqual([
      ['Bold', 'Bold'],
      ['Book', 'Book'],
      ['Roman', 'Roman']
    ])
  })

  test('a named face is available once it is loaded by its name', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Book',
      text: 'Book',
      fontFamily: 'Avenir',
      fontStyle: 'Book'
    })
    const manager = new FontManager()
    await manager.markLoaded('Avenir', 'Book', new ArrayBuffer(8), 'local')

    expect(documentFontStatus(graph, pageId(graph), manager)).toMatchObject({
      faithful: true,
      faces: [{ family: 'Avenir', name: 'Book', style: 'Book', status: 'available' }]
    })
  })
})

describe('DocumentFontUses', () => {
  test('follows a layer edited, added, moved off the page, and deleted', async () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    await manager.markLoaded('Inter', 'Regular', new ArrayBuffer(8), 'bundled')
    await manager.markLoaded('Example Sans', 'Regular', new ArrayBuffer(8), 'local')
    const page = pageId(graph)
    const title = graph.createNode('TEXT', page, {
      name: 'Title',
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400
    })
    const uses = new DocumentFontUses(graph, page)
    const families = () => uses.status(manager).faces.map((face) => face.family)
    expect(families()).toEqual(['Inter'])

    graph.updateNode(title.id, { fontFamily: 'Example Sans' })
    uses.update(title.id)
    expect(families()).toEqual(['Example Sans'])

    const frame = graph.createNode('FRAME', page, { name: 'Frame' })
    const caption = graph.createNode('TEXT', frame.id, {
      name: 'Caption',
      text: 'Hi',
      fontFamily: 'Inter',
      fontWeight: 400
    })
    uses.update(caption.id)
    expect(families()).toEqual(['Example Sans', 'Inter'])

    const otherPage = graph.addPage('Other')
    graph.reparentNode(caption.id, otherPage.id)
    uses.update(caption.id)
    expect(families()).toEqual(['Example Sans'])

    graph.deleteNode(title.id)
    uses.remove(title.id)
    expect(families()).toEqual([])

    // A frame moved off the page takes the text it holds with it, reported as the frame.
    graph.reparentNode(frame.id, otherPage.id)
    graph.createNode('TEXT', frame.id, { text: 'Hi', fontFamily: 'Inter', fontWeight: 400 })
    uses.update(frame.id)
    expect(families()).toEqual([])
    graph.reparentNode(frame.id, page)
    uses.update(frame.id)
    expect(families()).toEqual(['Inter'])
  })

  test('skips the text under an ancestor that was deleted', async () => {
    const graph = new SceneGraph()
    const manager = new FontManager()
    await manager.markLoaded('Inter', 'Regular', new ArrayBuffer(8), 'bundled')
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, { name: 'Frame' })
    graph.createNode('TEXT', frame.id, { text: 'Hi', fontFamily: 'Inter', fontWeight: 400 })
    const uses = new DocumentFontUses(graph, page)
    expect(uses.status(manager).faces).toHaveLength(1)

    graph.deleteNode(frame.id)
    uses.remove(frame.id)
    expect(uses.status(manager).faces).toEqual([])
  })
})
