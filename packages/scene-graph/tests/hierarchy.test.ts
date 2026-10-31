import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { repairHierarchy } from '@open-pencil/scene-graph/hierarchy'

/** Cases adapted from ShadowArcanist/willow "repair circular references on graph load" (MIT). */
function corruptGraph() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const a = graph.createNode('FRAME', page.id, { name: 'A' })
  const b = graph.createNode('FRAME', a.id, { name: 'B' })
  const c = graph.createNode('RECTANGLE', b.id, { name: 'C' })
  return { graph, page, a, b, c }
}

function depthFirst(graph: SceneGraph): string[] {
  const out: string[] = []
  const walk = (id: string, depth: number) => {
    if (depth > 50) throw new Error('cycle')
    out.push(id)
    for (const child of graph.getNode(id)?.childIds ?? []) walk(child, depth + 1)
  }
  walk(graph.rootId, 0)
  return out
}

describe('repairHierarchy', () => {
  test('a valid tree is left untouched', () => {
    const { graph } = corruptGraph()
    const before = depthFirst(graph)
    expect(repairHierarchy(graph)).toBe(0)
    expect(depthFirst(graph)).toEqual(before)
  })

  test('clears a parent on the root', () => {
    const { graph } = corruptGraph()
    const root = graph.getNode(graph.rootId)
    if (!root) throw new Error('missing root')
    root.parentId = graph.rootId
    expect(repairHierarchy(graph)).toBe(1)
    expect(root.parentId).toBeNull()
  })

  test('breaks a child list cycle (a descendant listing its ancestor)', () => {
    const { graph, a, b, c } = corruptGraph()
    c.childIds = [a.id]
    expect(() => depthFirst(graph)).toThrow('cycle')
    expect(repairHierarchy(graph)).toBeGreaterThan(0)
    expect(c.childIds).toEqual([])
    expect(depthFirst(graph)).toContain(c.id)
    expect(graph.isDescendant(c.id, a.id)).toBe(true)
    expect(b.parentId).toBe(a.id)
  })

  test('drops missing, repeated and second-parent child ids and fixes parentId', () => {
    const { graph, page, a, b, c } = corruptGraph()
    a.childIds = [b.id, b.id, 'missing:1', c.id]
    c.parentId = page.id
    expect(repairHierarchy(graph)).toBeGreaterThanOrEqual(3)
    expect(a.childIds).toEqual([b.id, c.id])
    expect(b.childIds).toEqual([])
    expect(c.parentId).toBe(a.id)
    const ids = depthFirst(graph)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('a self-listing node and the root listed as a child are dropped', () => {
    const { graph, a } = corruptGraph()
    a.childIds = [...a.childIds, a.id, graph.rootId]
    repairHierarchy(graph)
    expect(a.childIds).not.toContain(a.id)
    expect(a.childIds).not.toContain(graph.rootId)
    expect(() => depthFirst(graph)).not.toThrow()
  })

  test('a very deep chain is repaired without recursion', () => {
    const graph = new SceneGraph()
    let parent = graph.getPages()[0]
    for (let i = 0; i < 20_000; i++) parent = graph.createNode('FRAME', parent.id, {})
    expect(repairHierarchy(graph)).toBe(0)
  })
})
