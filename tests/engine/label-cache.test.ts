import { describe, it, expect } from 'bun:test'
import { SceneGraph, LabelCache } from '@verso/core'

function buildGraph() {
  const g = new SceneGraph()
  const pageId = g.getPages()[0].id

  const sectionId = g.createNode('SECTION', pageId, {
    name: 'Section 1',
    x: 0,
    y: 0,
    width: 200,
    height: 200
  }).id

  const nestedSectionId = g.createNode('SECTION', sectionId, {
    name: 'Nested Section',
    x: 10,
    y: 10,
    width: 100,
    height: 100
  }).id

  const compSetId = g.createNode('COMPONENT_SET', pageId, {
    name: 'Button Set',
    x: 300,
    y: 0,
    width: 200,
    height: 200
  }).id

  const compId = g.createNode('COMPONENT', compSetId, {
    name: 'Button',
    x: 10,
    y: 10,
    width: 80,
    height: 40
  }).id

  const standaloneCompId = g.createNode('COMPONENT', pageId, {
    name: 'Standalone',
    x: 600,
    y: 0,
    width: 100,
    height: 50
  }).id

  return { g, pageId, sectionId, nestedSectionId, compSetId, compId, standaloneCompId }
}

describe('LabelCache', () => {
  it('collects sections on first call', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)
    const sections = cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 })
    expect(sections.length).toBe(2)
    expect(sections.map((s) => s.node.name).sort()).toEqual(['Nested Section', 'Section 1'])
  })

  it('returns cached data when sceneVersion unchanged', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)
    const first = cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 })

    cache.update(g, pageId, 1)
    const second = cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 })

    expect(first.length).toBe(second.length)
    expect(first.map((s) => s.node.id)).toEqual(second.map((s) => s.node.id))
  })

  it('invalidates when sceneVersion changes', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)
    const before = cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 })

    g.createNode('SECTION', pageId, { name: 'New Section', x: 500, y: 500, width: 100, height: 100 })
    cache.update(g, pageId, 2)
    const after = cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 })

    expect(after.length).toBe(before.length + 1)
  })

  it('invalidates when pageId changes', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)
    expect(cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 }).length).toBe(2)

    const page2 = g.addPage('Page 2')
    cache.update(g, page2.id, 1)
    expect(cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 }).length).toBe(0)
  })

  it('filters sections by viewport', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)

    const all = cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 })
    expect(all.length).toBe(2)

    const visible = cache.getSections(g, { x: 0, y: 0, w: 50, h: 50 })
    expect(visible.length).toBeGreaterThan(0)

    const offscreen = cache.getSections(g, { x: 5000, y: 5000, w: 100, h: 100 })
    expect(offscreen.length).toBe(0)
  })

  it('tracks nested sections', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)
    const sections = cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 })

    const topLevel = sections.find((s) => s.node.name === 'Section 1')
    const nested = sections.find((s) => s.node.name === 'Nested Section')

    expect(topLevel?.nested).toBe(false)
    expect(nested?.nested).toBe(true)
  })

  it('collects components and component sets', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)
    const components = cache.getComponents(g, { x: -1000, y: -1000, w: 3000, h: 3000 })

    expect(components.length).toBe(3)
    const names = components.map((c) => c.node.name).sort()
    expect(names).toEqual(['Button', 'Button Set', 'Standalone'])
  })

  it('identifies components inside component sets', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)
    const components = cache.getComponents(g, { x: -1000, y: -1000, w: 3000, h: 3000 })

    const buttonSet = components.find((c) => c.node.name === 'Button Set')
    const button = components.find((c) => c.node.name === 'Button')
    const standalone = components.find((c) => c.node.name === 'Standalone')

    expect(buttonSet?.inside).toBe(false)
    expect(button?.inside).toBe(true)
    expect(standalone?.inside).toBe(false)
  })

  it('skips invisible nodes', () => {
    const { g, pageId, sectionId } = buildGraph()
    const cache = new LabelCache()

    g.updateNode(sectionId, { visible: false })
    cache.update(g, pageId, 1)

    const sections = cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 })
    const names = sections.map((s) => s.node.name)
    expect(names).not.toContain('Section 1')
    expect(names).not.toContain('Nested Section')
  })

  it('handles empty graph', () => {
    const g = new SceneGraph()
    const pageId = g.getPages()[0].id
    const cache = new LabelCache()

    cache.update(g, pageId, 0)
    expect(cache.getSections(g, { x: 0, y: 0, w: 1000, h: 1000 })).toEqual([])
    expect(cache.getComponents(g, { x: 0, y: 0, w: 1000, h: 1000 })).toEqual([])
  })

  it('explicit invalidate() forces recollection', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)
    expect(cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 }).length).toBe(2)

    g.createNode('SECTION', pageId, { name: 'Sneaky', x: 800, y: 0, width: 50, height: 50 })

    cache.update(g, pageId, 1)
    expect(cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 }).length).toBe(2)

    cache.invalidate()
    cache.update(g, pageId, 1)
    expect(cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 }).length).toBe(3)
  })

  it('computes correct absolute positions for nested nodes', () => {
    const { g, pageId } = buildGraph()
    const cache = new LabelCache()

    cache.update(g, pageId, 1)
    const sections = cache.getSections(g, { x: -1000, y: -1000, w: 3000, h: 3000 })

    const nested = sections.find((s) => s.node.name === 'Nested Section')
    expect(nested?.absX).toBe(10)
    expect(nested?.absY).toBe(10)

    const components = cache.getComponents(g, { x: -1000, y: -1000, w: 3000, h: 3000 })
    const button = components.find((c) => c.node.name === 'Button')
    expect(button?.absX).toBe(310)
    expect(button?.absY).toBe(10)
  })
})
