import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { copyStyleRuns } from '@open-pencil/scene-graph/copy'
import { scaledGeometryChanges } from '@open-pencil/scene-graph/resize'

const shapingEdits: Partial<SceneNode>[] = [
  { fontVariations: [{ axis: 'wght', value: 600 }] },
  { fontFeatures: [{ tag: 'liga', enabled: false }] },
  { textAlignHorizontal: 'RIGHT' },
  { textAlignVertical: 'BOTTOM' },
  { height: 80 }
]
for (const change of shapingEdits) {
  test(`invalidates saved glyph placement for ${Object.keys(change)[0]}`, () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Text',
      derivedTextGlyphs: [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 12 }]
    })
    graph.updateNode(node.id, change)
    expect(node.derivedTextGlyphs).toBeNull()
  })
}

for (const field of ['width', 'textAutoResize', 'maxLines'] as const) {
  test(`changing ${field} invalidates saved glyphs but supplying new glyphs preserves them`, () => {
    const graph = new SceneGraph()
    const glyphs = [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 12 }]
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Text',
      derivedTextGlyphs: glyphs
    })
    const changes = { width: 120, textAutoResize: 'HEIGHT' as const, maxLines: 2 }
    graph.updateNode(node.id, { [field]: changes[field] })
    expect(node.derivedTextGlyphs).toBeNull()
    graph.updateNode(node.id, { [field]: changes[field], derivedTextGlyphs: glyphs })
    expect(node.derivedTextGlyphs).toEqual(glyphs)
  })
}

for (const preview of [false, true]) {
  test(`equal layout updates preserve saved glyphs (preview=${preview})`, () => {
    const graph = new SceneGraph()
    const glyphs = [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 12 }]
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Text',
      derivedTextGlyphs: glyphs
    })
    const update = preview ? graph.updateNodePreview.bind(graph) : graph.updateNode.bind(graph)
    update(node.id, {
      width: node.width,
      height: node.height,
      styleRuns: copyStyleRuns(node.styleRuns)
    })
    expect(node.derivedTextGlyphs).toEqual(glyphs)
  })
  test(`text layout cache invalidation preserves supplied replacements (preview=${preview})`, () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Initial',
      derivedLayout: { width: 67, height: 24 }
    })
    const update = preview ? graph.updateNodePreview.bind(graph) : graph.updateNode.bind(graph)
    update(node.id, { opacity: 0.5 })
    expect(node.derivedLayout).toEqual({ width: 67, height: 24 })
    update(node.id, { text: 'Replacement', derivedLayout: { width: 120, height: 24 } })
    expect(node.derivedLayout).toEqual({ width: 120, height: 24 })
    update(node.id, { fontSize: 20 })
    expect(node.derivedLayout).toBeNull()
  })
}

test('resizing flat text drops its glyphs so it reflows, while path text scales them', () => {
  const graph = new SceneGraph()
  const glyphs = [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 12, rotation: 0 }]
  const flat = graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Text',
    width: 100,
    height: 20,
    derivedTextGlyphs: glyphs
  })
  const path = graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Text',
    width: 100,
    height: 20,
    derivedTextGlyphs: glyphs.map((glyph) => ({ ...glyph, rotation: -0.5 }))
  })
  for (const node of [flat, path]) {
    graph.updateNode(node.id, {
      width: 200,
      ...scaledGeometryChanges(node, node.width, node.height, 200, node.height)
    })
  }

  expect(flat.derivedTextGlyphs).toBeNull()
  expect(path.derivedTextGlyphs?.[0].scaleX).toBe(2)
})

describe('text cache resets', () => {
  const glyphs = [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 12 }]
  const cached = (graph: SceneGraph) =>
    graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Text',
      width: 100,
      height: 20,
      derivedLayout: { width: 100, height: 20 },
      derivedTextGlyphs: glyphs
    })
  const publish = (graph: SceneGraph) => {
    const updates: Partial<SceneNode>[] = []
    graph.onNodeEvents({ updated: (_id, changes) => updates.push({ ...changes }) })
    return updates
  }

  test('a size put back during layout still publishes the caches it reset', () => {
    const graph = new SceneGraph()
    const node = cached(graph)
    const updates = publish(graph)

    graph.withLayoutMutations(() => {
      graph.updateNode(node.id, { width: 50 })
      graph.updateNode(node.id, { width: 100 })
    })

    expect(node.derivedLayout).toBeNull()
    expect(node.derivedTextGlyphs).toBeNull()
    expect(updates).toEqual([{ derivedLayout: null, derivedTextGlyphs: null }])
  })

  test('a size put back during layout publishes nothing when nothing was cached', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, { text: 'Text', width: 100 })
    const updates = publish(graph)

    graph.withLayoutMutations(() => {
      graph.updateNode(node.id, { width: 50 })
      graph.updateNode(node.id, { width: 100 })
    })

    expect(updates).toEqual([])
  })

  test('a direct edit carries only the caches that were set', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, { text: 'Text', width: 100 })
    const updates = publish(graph)

    graph.updateNode(node.id, { width: 50 })

    expect(updates).toEqual([{ width: 50 }])
  })

  test('values the caller supplies win over the resets', () => {
    const graph = new SceneGraph()
    const node = cached(graph)
    Object.assign(node, { textPicture: new Uint8Array([1]) })
    const picture = new Uint8Array([2])
    graph.updateNode(node.id, { width: 50, textPicture: picture })
    expect(node.textPicture).toBe(picture)

    const pathData = {
      network: { vertices: [], segments: [], regions: [] },
      normalizedSize: { x: 1, y: 1 },
      tValue: 0,
      forward: true
    }
    Object.assign(node, { derivedTextGlyphs: glyphs })
    graph.updateNode(node.id, { text: 'Old', derivedTextGlyphs: null, textPathData: pathData })
    expect(node.textPathData).toBe(pathData)
  })
})
