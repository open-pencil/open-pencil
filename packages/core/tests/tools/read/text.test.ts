import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

const tool = ALL_TOOLS.find((candidate) => candidate.name === 'export_text')
if (!tool) throw new Error('export_text tool missing')

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const page = figma.currentPageId
  const frame = graph.createNode('FRAME', page)
  const first = graph.createNode('TEXT', frame.id, { text: '  Heading\nwith a second line  ' })
  const group = graph.createNode('GROUP', frame.id)
  const second = graph.createNode('TEXT', group.id, { text: 'Amount: €12.50', y: -100 })
  return { graph, figma, page, frame, first, group, second }
}

describe('export_text', () => {
  test('preserves text and layer order without rendering, selecting, or changing the graph', () => {
    const { graph, figma, frame, first, second } = setup()
    figma.currentPage.selection = [figma.wrapNode(second.id)]
    const changes: string[] = []
    const stop = graph.onNodeEvents({ updated: (id) => changes.push(id) })
    let renders = 0
    figma.exportImage = async () => {
      renders++
      return new Uint8Array()
    }
    try {
      expect(tool.execute(figma, { ids: [frame.id] })).toEqual({
        text: '  Heading\nwith a second line  \n\nAmount: €12.50',
        textNodeCount: 2,
        truncated: false
      })
      expect(figma.currentPage.selection.map((node) => node.id)).toEqual([second.id])
      expect(graph.getNode(first.id)?.text).toBe('  Heading\nwith a second line  ')
      expect(changes).toEqual([])
      expect(renders).toBe(0)
    } finally {
      stop()
    }
  })

  test('deduplicates roots and descendants even when the descendant is requested first', () => {
    const { figma, frame, first, second } = setup()
    expect(tool.execute(figma, { ids: [second.id, frame.id, frame.id, first.id] })).toEqual(
      tool.execute(figma, { ids: [frame.id] })
    )
  })

  test('exports the current page when IDs are omitted, not the selection or other pages', () => {
    const { graph, figma, frame, first } = setup()
    figma.currentPage.selection = [figma.wrapNode(first.id)]
    const other = graph.addPage('Other')
    graph.createNode('TEXT', other.id, { text: 'Other page' })
    expect(tool.execute(figma, {})).toEqual(tool.execute(figma, { ids: [frame.id] }))
  })

  test('uses the targeted current page', () => {
    const { graph, figma } = setup()
    const page = graph.addPage('Target')
    graph.createNode('TEXT', page.id, { text: 'Target page' })
    figma.currentPage = figma.wrapNode(page.id)
    expect(tool.execute(figma, {})).toEqual({
      text: 'Target page',
      textNodeCount: 1,
      truncated: false
    })
  })

  test('excludes hidden descendants and explicitly requested nodes inside hidden ancestors', () => {
    const { graph, figma, frame, first, group, second } = setup()
    graph.updateNode(group.id, { visible: false })
    expect(tool.execute(figma, { ids: [frame.id] })).toEqual({
      text: first.text,
      textNodeCount: 1,
      truncated: false
    })
    expect(tool.execute(figma, { ids: [second.id] })).toEqual({
      text: '',
      textNodeCount: 0,
      truncated: false
    })
    expect(tool.execute(figma, { ids: [second.id], includeHidden: true })).toEqual({
      text: 'Amount: €12.50',
      textNodeCount: 1,
      truncated: false
    })
    expect(tool.execute(figma, { ids: [frame.id], includeHidden: true })).toEqual({
      text: '  Heading\nwith a second line  \n\nAmount: €12.50',
      textNodeCount: 2,
      truncated: false
    })
  })

  test('returns empty text when there are no text nodes', () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    graph.createNode('RECTANGLE', figma.currentPageId)
    expect(tool.execute(figma, {})).toEqual({ text: '', textNodeCount: 0, truncated: false })
  })

  test('rejects unknown IDs instead of returning an apparently complete subset', () => {
    const { figma, frame } = setup()
    expect(tool.execute(figma, { ids: [frame.id, 'missing'] })).toEqual({
      error: 'Node "missing" not found'
    })
  })

  test('truncates text and includes separators in the character budget', () => {
    const { graph, figma, frame, first, second } = setup()
    graph.updateNode(first.id, { text: 'ABC' })
    graph.updateNode(second.id, { text: 'DEF' })
    expect(tool.execute(figma, { ids: [frame.id], maxChars: 6 })).toEqual({
      text: 'ABC\n\nD',
      textNodeCount: 2,
      truncated: true
    })
    expect(tool.execute(figma, { ids: [frame.id], maxChars: 4 })).toEqual({
      text: 'ABC',
      textNodeCount: 1,
      truncated: true
    })
    expect(tool.execute(figma, { ids: [first.id], maxChars: 3 })).toEqual({
      text: 'ABC',
      textNodeCount: 1,
      truncated: false
    })
  })

  test('does not split emoji at the output boundary', () => {
    const { graph, figma, first } = setup()
    graph.updateNode(first.id, { text: 'A😀B' })
    expect(tool.execute(figma, { ids: [first.id], maxChars: 2 })).toEqual({
      text: 'A',
      textNodeCount: 1,
      truncated: true
    })
    expect(tool.execute(figma, { ids: [first.id], maxChars: 3 })).toEqual({
      text: 'A😀',
      textNodeCount: 1,
      truncated: true
    })
    graph.updateNode(first.id, { text: 'A\ud83d' })
    expect(tool.execute(figma, { ids: [first.id], maxChars: 2 })).toEqual({
      text: 'A\ud83d',
      textNodeCount: 1,
      truncated: false
    })
  })

  test('bounds traversal of non-text layers and reports an incomplete result', () => {
    const { figma, frame, first } = setup()
    expect(tool.execute(figma, { ids: [frame.id], maxNodes: 2 })).toEqual({
      text: first.text,
      textNodeCount: 1,
      truncated: true
    })
    expect(tool.execute(figma, { ids: [first.id], maxNodes: 1 })).toEqual({
      text: first.text,
      textNodeCount: 1,
      truncated: false
    })
  })

  test('bounds output by default', () => {
    const { graph, figma, first } = setup()
    graph.updateNode(first.id, { text: 'x'.repeat(40_000) })
    expect(tool.execute(figma, { ids: [first.id] })).toEqual({
      text: 'x'.repeat(32_000),
      textNodeCount: 1,
      truncated: true
    })
  })

  test('reads pages with more top-level layers than an explicit root list allows', () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    for (let index = 0; index < 1_001; index++) {
      graph.createNode('TEXT', figma.currentPageId, { text: 'x' })
    }
    expect(tool.execute(figma, {})).toEqual({
      text: Array.from({ length: 1_001 }, () => 'x').join('\n\n'),
      textNodeCount: 1_001,
      truncated: false
    })
  })

  test('keeps independent roots in requested order and preserves empty text nodes', () => {
    const { graph, figma, first, second } = setup()
    graph.updateNode(first.id, { text: '' })
    expect(tool.execute(figma, { ids: [second.id, first.id] })).toEqual({
      text: 'Amount: €12.50\n\n',
      textNodeCount: 2,
      truncated: false
    })
  })

  test.each([
    { ids: [] },
    { maxChars: 0 },
    { maxChars: 32_001 },
    { maxNodes: 10_001 },
    { maxNodes: 1.5 }
  ])('rejects invalid limits or empty IDs: %j', (args) => {
    expect(() => tool.execute(setup().figma, args)).toThrow('Invalid arguments for export_text')
  })
})
