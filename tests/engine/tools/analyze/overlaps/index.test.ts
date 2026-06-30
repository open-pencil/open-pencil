import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import {
  analyzeOverlaps,
  computeOverlaps,
  type OverlapScope
} from '@open-pencil/core/tools/analyze/overlaps'

import { frame, pageId, rect, text } from './helpers'

describe('analyze overlaps', () => {
  test('detects overlapping sibling rectangles', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Parent', page, 0, 0, 200, 200)
    rect(graph, 'A', parent.id, 0, 0, 100, 100)
    rect(graph, 'B', parent.id, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { scope: 'same-parent' })
    expect(result.summary.overlapCount).toBeGreaterThan(0)
    expect(result.overlaps.some((o) => o.category === 'sibling-overlap')).toBe(true)
  })

  test('ignores separated rectangles', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'A', page, 0, 0, 50, 50)
    rect(graph, 'B', page, 200, 200, 50, 50)

    const result = computeOverlaps(graph)
    expect(result.summary.overlapCount).toBe(0)
  })

  test('skips hidden and locked nodes by default', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'A', page, 0, 0, 100, 100)
    const hidden = rect(graph, 'Hidden', page, 50, 50, 100, 100)
    graph.updateNode(hidden.id, { visible: false })

    const result = computeOverlaps(graph)
    expect(result.summary.overlapCount).toBe(0)
  })

  test('includes hidden nodes when include_hidden is true', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'A', page, 0, 0, 100, 100)
    const hidden = rect(graph, 'Hidden', page, 50, 50, 100, 100)
    graph.updateNode(hidden.id, { visible: false })

    const result = computeOverlaps(graph, { include_hidden: true })
    expect(result.summary.overlapCount).toBeGreaterThan(0)
  })

  test('reports text that overflows a non-clipping frame', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Frame', page, 0, 0, 80, 80)
    text(graph, 'Wide', parent.id, 0, 0, 200, 20)

    const result = computeOverlaps(graph)
    expect(result.overlaps.some((o) => o.category === 'parent-overflow')).toBe(true)
  })

  test('reports a child that is fully outside its non-clipping parent', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Frame', page, 0, 0, 100, 100)
    rect(graph, 'Stray', parent.id, 200, 0, 50, 50)

    const result = computeOverlaps(graph)
    expect(result.overlaps).toHaveLength(1)
    const overflow = result.overlaps[0]
    expect(overflow.category).toBe('parent-overflow')
    expect(overflow.area).toBe(2500)
    expect(overflow.ratio).toBe(1)
  })

  test('does not report overflow when parent clips content', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Frame', page, 0, 0, 80, 80, true)
    text(graph, 'Wide', parent.id, 0, 0, 200, 20)

    const result = computeOverlaps(graph)
    expect(result.overlaps).toHaveLength(0)
  })

  test('detects rotated overlap', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'A', page, 0, 0, 100, 20)
    const rotated = rect(graph, 'B', page, 0, 0, 100, 20)
    graph.updateNode(rotated.id, { rotation: 45 })

    const result = computeOverlaps(graph)
    expect(result.summary.overlapCount).toBeGreaterThan(0)
  })

  test('detects a suspicious overlay covering a smaller sibling', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    // Create the smaller node first so the later (and therefore visually on-top) larger node
    // genuinely covers it.
    rect(graph, 'Badge', page, 10, 10, 10, 10)
    rect(graph, 'Backdrop', page, 0, 0, 100, 100)

    const result = computeOverlaps(graph)
    expect(result.overlaps.some((o) => o.category === 'overlay')).toBe(true)
    const overlay = result.overlaps.find((o) => o.category === 'overlay')
    expect(overlay?.message).toContain('"Backdrop" appears to be an overlay covering "Badge"')
  })

  test('filters by node type', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'A', page, 0, 0, 100, 100)
    const t = text(graph, 'B', page, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { type: 'TEXT' })
    expect(result.overlaps.every((o) => o.nodeA.id === t.id || o.nodeB.id === t.id)).toBe(true)
  })

  test('respects min_area threshold', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'A', page, 0, 0, 100, 100)
    rect(graph, 'B', page, 99, 99, 2, 2)

    const result = computeOverlaps(graph, { min_area: 100 })
    expect(result.summary.overlapCount).toBe(0)
  })

  test('does not flag ancestor-descendant overlap', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Frame', page, 0, 0, 200, 200)
    rect(graph, 'Child', parent.id, 0, 0, 100, 100)

    const result = computeOverlaps(graph)
    expect(result.summary.overlapCount).toBe(0)
  })

  test('scope=same-parent only reports siblings sharing a parent', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parentA = frame(graph, 'ParentA', page, 0, 0, 200, 200)
    const parentB = frame(graph, 'ParentB', page, 300, 0, 200, 200)
    rect(graph, 'A1', parentA.id, 0, 0, 100, 100)
    rect(graph, 'A2', parentA.id, 50, 50, 100, 100)
    rect(graph, 'B1', parentB.id, 0, 0, 100, 100)
    rect(graph, 'B2', parentB.id, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { scope: 'same-parent', category: 'sibling-overlap' })
    expect(result.summary.overlapCount).toBe(2)
    expect(
      result.overlaps.every(
        (o) => o.nodeA.parentId === o.nodeB.parentId && o.nodeA.parentId !== page
      )
    ).toBe(true)
  })

  test('scope=cross-parent only reports nodes from different parents', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parentA = frame(graph, 'ParentA', page, 0, 0, 200, 200)
    const parentB = frame(graph, 'ParentB', page, 300, 0, 200, 200)
    rect(graph, 'A', parentA.id, 150, 0, 110, 100)
    rect(graph, 'B', parentB.id, -60, 0, 110, 100)

    const result = computeOverlaps(graph, { scope: 'cross-parent', category: 'sibling-overlap' })
    expect(result.summary.overlapCount).toBe(1)
    expect(result.overlaps[0].nodeA.parentId).not.toBe(result.overlaps[0].nodeB.parentId)
  })

  test('scope=top-level only reports direct page children', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'TopA', page, 0, 0, 100, 100)
    rect(graph, 'TopB', page, 50, 50, 100, 100)
    const parent = frame(graph, 'Parent', page, 300, 300, 200, 200)
    rect(graph, 'InnerA', parent.id, 0, 0, 100, 100)
    rect(graph, 'InnerB', parent.id, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { scope: 'top-level' })
    expect(result.summary.overlapCount).toBe(1)
    expect(result.overlaps[0].nodeA.parentId).toBe(page)
    expect(result.overlaps[0].nodeB.parentId).toBe(page)
  })

  test('scope=inside-parent only reports children inside a non-page parent', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'TopA', page, 0, 0, 100, 100)
    rect(graph, 'TopB', page, 50, 50, 100, 100)
    const parent = frame(graph, 'Parent', page, 300, 300, 200, 200)
    rect(graph, 'InnerA', parent.id, 0, 0, 100, 100)
    rect(graph, 'InnerB', parent.id, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { scope: 'inside-parent' })
    expect(result.summary.overlapCount).toBe(1)
    expect(result.overlaps[0].nodeA.parentId).toBe(parent.id)
    expect(result.overlaps[0].nodeB.parentId).toBe(parent.id)
  })

  test('respects min_ratio threshold', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Parent', page, 0, 0, 200, 200)
    rect(graph, 'A', parent.id, 0, 0, 100, 100)
    rect(graph, 'B', parent.id, 50, 50, 100, 100)

    const excluded = computeOverlaps(graph, { scope: 'same-parent', min_ratio: 0.5 })
    expect(excluded.overlaps).toHaveLength(0)

    const included = computeOverlaps(graph, { scope: 'same-parent', min_ratio: 0.1 })
    expect(included.overlaps.length).toBeGreaterThan(0)
  })

  test('excludes locked nodes by default', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const locked = rect(graph, 'Locked', page, 0, 0, 100, 100)
    graph.updateNode(locked.id, { locked: true })
    rect(graph, 'A', page, 50, 50, 100, 100)

    const result = computeOverlaps(graph)
    expect(
      result.overlaps.some((o) => o.nodeA.name === 'Locked' || o.nodeB.name === 'Locked')
    ).toBe(false)
  })

  test('includes locked nodes when include_locked is true', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const locked = rect(graph, 'Locked', page, 0, 0, 100, 100)
    graph.updateNode(locked.id, { locked: true })
    rect(graph, 'A', page, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { include_locked: true })
    expect(
      result.overlaps.some((o) => o.nodeA.name === 'Locked' || o.nodeB.name === 'Locked')
    ).toBe(true)
  })

  test('excludes absolutely-positioned nodes by default', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const absolute = rect(graph, 'Absolute', page, 0, 0, 100, 100)
    graph.updateNode(absolute.id, { layoutPositioning: 'ABSOLUTE' })
    rect(graph, 'A', page, 50, 50, 100, 100)

    const result = computeOverlaps(graph)
    expect(
      result.overlaps.some((o) => o.nodeA.name === 'Absolute' || o.nodeB.name === 'Absolute')
    ).toBe(false)
  })

  test('includes absolutely-positioned nodes when include_absolute is true', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const absolute = rect(graph, 'Absolute', page, 0, 0, 100, 100)
    graph.updateNode(absolute.id, { layoutPositioning: 'ABSOLUTE' })
    rect(graph, 'A', page, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { include_absolute: true })
    expect(
      result.overlaps.some((o) => o.nodeA.name === 'Absolute' || o.nodeB.name === 'Absolute')
    ).toBe(true)
  })

  test('filters results by page name', () => {
    const graph = new SceneGraph()
    const page1 = pageId(graph)
    const page2 = graph.addPage('Page 2')

    const a1 = rect(graph, 'A1', page1, 0, 0, 100, 100)
    const a2 = rect(graph, 'A2', page1, 50, 50, 100, 100)
    const b1 = rect(graph, 'B1', page2.id, 0, 0, 100, 100)
    const b2 = rect(graph, 'B2', page2.id, 50, 50, 100, 100)

    const page1Result = computeOverlaps(graph, { page: 'Page 1' })
    expect(page1Result.overlaps.length).toBeGreaterThan(0)
    expect(
      page1Result.overlaps.every(
        (o) =>
          (o.nodeA.id === a1.id || o.nodeA.id === a2.id) &&
          (o.nodeB.id === a1.id || o.nodeB.id === a2.id)
      )
    ).toBe(true)

    const page2Result = computeOverlaps(graph, { page: 'Page 2' })
    expect(page2Result.overlaps.length).toBeGreaterThan(0)
    expect(
      page2Result.overlaps.every(
        (o) =>
          (o.nodeA.id === b1.id || o.nodeA.id === b2.id) &&
          (o.nodeB.id === b1.id || o.nodeB.id === b2.id)
      )
    ).toBe(true)

    const missing = computeOverlaps(graph, { page: 'Missing' })
    expect(missing.overlaps).toHaveLength(0)
  })

  test('scope values are case-insensitive', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'A', page, 0, 0, 100, 100)
    rect(graph, 'B', page, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { scope: 'SAME-PARENT' as OverlapScope })
    expect(result.overlaps.length).toBeGreaterThan(0)
  })

  test('scope and severity inputs are trimmed of surrounding whitespace', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'A', page, 0, 0, 100, 100)
    rect(graph, 'B', page, 50, 50, 100, 100)

    const scoped = computeOverlaps(graph, { scope: '  same-parent  ' as OverlapScope })
    expect(scoped.overlaps.length).toBeGreaterThan(0)

    const severityCapped = computeOverlaps(graph, {
      scope: '  same-parent  ' as OverlapScope,
      severity: '  minor  ' as OverlapSeverity
    })
    // Both overlaps are minor sibling-overlaps, so trimming severity keeps them.
    expect(severityCapped.overlaps.length).toBe(scoped.overlaps.length)
  })

  test('ToolDef defaults to current page and does not report overlaps on other pages', () => {
    const graph = new SceneGraph()
    const page2 = graph.addPage('Page 2')

    rect(graph, 'A', page2.id, 0, 0, 100, 100)
    rect(graph, 'B', page2.id, 50, 50, 100, 100)

    const api = new FigmaAPI(graph)
    const result = analyzeOverlaps.execute(api, {})
    expect(result.summary.overlapCount).toBe(0)
    expect(result.overlaps).toHaveLength(0)
  })

  test('ToolDef respects explicit page argument', () => {
    const graph = new SceneGraph()
    const page2 = graph.addPage('Page 2')

    rect(graph, 'A', page2.id, 0, 0, 100, 100)
    rect(graph, 'B', page2.id, 50, 50, 100, 100)

    const api = new FigmaAPI(graph)
    const result = analyzeOverlaps.execute(api, { page: 'Page 2' })
    expect(result.summary.overlapCount).toBeGreaterThan(0)
  })

  test('scope=top-level excludes nested parent-overflow', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Frame', page, 0, 0, 80, 80)
    text(graph, 'Wide', parent.id, 0, 0, 200, 20)

    const all = computeOverlaps(graph)
    expect(all.overlaps.some((o) => o.category === 'parent-overflow')).toBe(true)

    const topLevel = computeOverlaps(graph, { scope: 'top-level' })
    expect(topLevel.overlaps.some((o) => o.category === 'parent-overflow')).toBe(false)
  })

  test('scope=inside-parent includes nested parent-overflow', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Frame', page, 0, 0, 80, 80)
    text(graph, 'Wide', parent.id, 0, 0, 200, 20)

    const result = computeOverlaps(graph, { scope: 'inside-parent' })
    expect(result.overlaps.some((o) => o.category === 'parent-overflow')).toBe(true)
  })

  test('skips nodes inside a hidden ancestor by default', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const hiddenParent = frame(graph, 'HiddenParent', page, 0, 0, 200, 200)
    graph.updateNode(hiddenParent.id, { visible: false })
    rect(graph, 'A', hiddenParent.id, 0, 0, 100, 100)
    rect(graph, 'B', hiddenParent.id, 50, 50, 100, 100)

    const result = computeOverlaps(graph)
    expect(result.summary.overlapCount).toBe(0)
  })

  test('includes nodes inside a hidden ancestor when include_hidden is true', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const hiddenParent = frame(graph, 'HiddenParent', page, 0, 0, 200, 200)
    graph.updateNode(hiddenParent.id, { visible: false })
    rect(graph, 'A', hiddenParent.id, 0, 0, 100, 100)
    rect(graph, 'B', hiddenParent.id, 50, 50, 100, 100)

    const result = computeOverlaps(graph, { include_hidden: true })
    expect(result.summary.overlapCount).toBeGreaterThan(0)
  })

  test('skips nodes inside a locked ancestor by default', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const lockedParent = frame(graph, 'LockedParent', page, 0, 0, 200, 200)
    graph.updateNode(lockedParent.id, { locked: true })
    rect(graph, 'A', lockedParent.id, 0, 0, 100, 100)
    rect(graph, 'B', lockedParent.id, 50, 50, 100, 100)

    const result = computeOverlaps(graph)
    expect(result.summary.overlapCount).toBe(0)
  })

  test('summary totals reflect full result set when a limit is applied', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Frame', page, 0, 0, 200, 200)

    for (let i = 0; i < 4; i++) {
      rect(graph, `R${i}`, parent.id, 0, 0, 100, 100)
    }

    const result = computeOverlaps(graph, { scope: 'inside-parent', limit: 2 })
    expect(result.overlaps.length).toBe(2)
    expect(result.summary.overlapCount).toBeGreaterThan(2)

    const totalByCategory = Object.values(result.summary.byCategory).reduce((a, b) => a + b, 0)
    expect(totalByCategory).toBe(result.summary.overlapCount)
    const totalBySeverity = Object.values(result.summary.bySeverity).reduce((a, b) => a + b, 0)
    expect(totalBySeverity).toBe(result.summary.overlapCount)
  })

  test('limit of zero returns no overlaps while the summary still reports the full set', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Frame', page, 0, 0, 200, 200)

    for (let i = 0; i < 4; i++) {
      rect(graph, `R${i}`, parent.id, 0, 0, 100, 100)
    }

    const result = computeOverlaps(graph, { scope: 'inside-parent', limit: 0 })
    expect(result.overlaps).toHaveLength(0)
    expect(result.summary.overlapCount).toBeGreaterThan(0)
  })

  test('a negative limit is clamped to zero and returns no overlaps', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = frame(graph, 'Frame', page, 0, 0, 200, 200)

    for (let i = 0; i < 4; i++) {
      rect(graph, `R${i}`, parent.id, 0, 0, 100, 100)
    }

    const result = computeOverlaps(graph, { scope: 'inside-parent', limit: -3 })
    expect(result.overlaps).toHaveLength(0)
    expect(result.summary.overlapCount).toBeGreaterThan(0)
  })
})
