import { expect, test } from 'bun:test'

import { SceneGraph, copyStyleRuns } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

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
