import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import {
  analyzeOverlaps,
  computeOverlaps,
  findPageId
} from '@open-pencil/core/tools/analyze/overlaps'

import { pageId, rect } from './helpers'

describe('analyze overlaps page scope', () => {
  test('default scope limits analysis to a single page', () => {
    const graph = new SceneGraph()
    const page1 = pageId(graph)
    const page2 = graph.addPage('Page 2')

    rect(graph, 'A', page1, 0, 0, 100, 100)
    rect(graph, 'B', page1, 50, 50, 100, 100)
    rect(graph, 'C', page2.id, 0, 0, 100, 100)
    rect(graph, 'D', page2.id, 50, 50, 100, 100)

    const result = computeOverlaps(graph)
    expect(result.summary.overlapCount).toBe(1)
    expect(result.overlaps).toHaveLength(1)
    expect(
      result.overlaps.every((o) => {
        const nodeA = graph.getNode(o.nodeA.id)
        const nodeB = graph.getNode(o.nodeB.id)
        if (!nodeA || !nodeB) return false
        return findPageId(graph, nodeA) === page1 && findPageId(graph, nodeB) === page1
      })
    ).toBe(true)
  })

  test('missing page name returns an empty result', () => {
    const graph = new SceneGraph()
    const page1 = pageId(graph)
    const page2 = graph.addPage('Page 2')

    rect(graph, 'A', page1, 0, 0, 100, 100)
    rect(graph, 'B', page1, 50, 50, 100, 100)
    rect(graph, 'C', page2.id, 0, 0, 100, 100)
    rect(graph, 'D', page2.id, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { page: 'Missing' })
    expect(result.summary.totalNodes).toBe(0)
    expect(result.summary.analyzedNodes).toBe(0)
    expect(result.summary.overlapCount).toBe(0)
    expect(result.overlaps).toHaveLength(0)
  })

  test('ToolDef currentPage default uses page ID so duplicate page names do not leak', () => {
    const graph = new SceneGraph()
    const page1 = pageId(graph)
    const page2 = graph.addPage('Page 1')

    rect(graph, 'A', page2.id, 0, 0, 100, 100)
    rect(graph, 'B', page2.id, 50, 50, 100, 100)

    const api = new FigmaAPI(graph)
    expect(api.currentPageId).toBe(page1)

    const defaultResult = analyzeOverlaps.execute(api, {})
    expect(defaultResult.summary.overlapCount).toBe(0)
    expect(defaultResult.overlaps).toHaveLength(0)

    api.currentPage = api.wrapNode(page2.id)
    const currentResult = analyzeOverlaps.execute(api, {})
    expect(currentResult.summary.overlapCount).toBeGreaterThan(0)
  })

  test('page_id argument disambiguates duplicate page names', () => {
    const graph = new SceneGraph()
    const page1 = pageId(graph)
    const page2 = graph.addPage('Page 1')

    rect(graph, 'A', page2.id, 0, 0, 100, 100)
    rect(graph, 'B', page2.id, 50, 50, 100, 100)

    const byId = computeOverlaps(graph, { page_id: page2.id })
    expect(byId.summary.overlapCount).toBe(1)

    const byName = computeOverlaps(graph, { page: 'Page 1' })
    expect(byName.summary.overlapCount).toBe(0)

    const byFirstPage = computeOverlaps(graph, { page_id: page1 })
    expect(byFirstPage.summary.overlapCount).toBe(0)
  })
})
