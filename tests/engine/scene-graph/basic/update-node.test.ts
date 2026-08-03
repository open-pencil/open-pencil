import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

import { pageId, rect } from './helpers'

const decorationFill = {
  type: 'SOLID' as const,
  color: { r: 1, g: 0, b: 0, a: 1 },
  visible: true,
  opacity: 1
}

const advancedTextInvalidationCases: Array<[string, Partial<SceneNode>]> = [
  ['textAutoResize', { textAutoResize: 'TRUNCATE' }],
  ['textDecorationStyle', { textDecorationStyle: 'DOTTED' }],
  ['textDecorationThickness', { textDecorationThickness: 2 }],
  ['textDecorationFills', { textDecorationFills: [decorationFill] }],
  ['textDecorationSkipInk', { textDecorationSkipInk: false }],
  ['textUnderlineOffset', { textUnderlineOffset: 4 }],
  ['leadingTrim', { leadingTrim: 'CAP_HEIGHT' }],
  ['maxLines', { maxLines: 1 }],
  ['fontVariations', { fontVariations: [{ axis: 'wght', value: 700 }] }],
  ['fontFeatures', { fontFeatures: [{ tag: 'liga', enabled: false }] }],
  ['textTruncation', { textTruncation: 'ENDING' }]
]

describe('updateNode', () => {
  test('non-layout change does not clear absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 100, 200)
    // Populate absPosCache by calling getAbsolutePosition
    const absPos = graph.getAbsolutePosition(rId)
    expect(absPos).toEqual({ x: 100, y: 200 })
    // Change fills (non-layout property)
    graph.updateNode(rId, { fills: [] })
    // Cache should still be valid
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).toBe(absPos) // same reference = cache hit
  })

  test('layout change clears absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 100, 200)
    const absPos = graph.getAbsolutePosition(rId)
    expect(absPos).toEqual({ x: 100, y: 200 })
    // Change x (layout-affecting property)
    graph.updateNode(rId, { x: 150 })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).toEqual({ x: 150, y: 200 })
    expect(absPos2).not.toBe(absPos) // different reference = cache miss
  })

  test('instance index updated on componentId change', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const comp1 = graph.createNode('COMPONENT', page, {
      name: 'C1',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    const comp2 = graph.createNode('COMPONENT', page, {
      name: 'C2',
      x: 100,
      y: 0,
      width: 50,
      height: 50
    })
    const inst = graph.createInstance(comp1.id, page, { x: 200, y: 0 })
    // Instance should be indexed under comp1
    expect(graph.instanceIndex.get(comp1.id)?.has(inst.id)).toBe(true)
    // Re-point instance to comp2
    graph.updateNode(inst.id, { componentId: comp2.id })
    // Old index entry removed, new one added
    expect(graph.instanceIndex.get(comp1.id)?.has(inst.id)).toBeFalsy()
    expect(graph.instanceIndex.get(comp2.id)?.has(inst.id)).toBe(true)
  })

  test('updateNode on nonexistent node is a no-op', () => {
    const graph = new SceneGraph()
    // Should not throw
    graph.updateNode('nonexistent-id', { x: 100 })
  })

  test('y change clears absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)
    expect(absPos).toEqual({ x: 10, y: 20 })
    graph.updateNode(rId, { y: 99 })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).toEqual({ x: 10, y: 99 })
    expect(absPos2).not.toBe(absPos)
  })

  test('width change clears absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20, 50, 50)
    const absPos = graph.getAbsolutePosition(rId)
    graph.updateNode(rId, { width: 200 })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).not.toBe(absPos)
  })

  test('rotation change clears absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)
    graph.updateNode(rId, { rotation: 45 })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).not.toBe(absPos)
  })

  test('paddingLeft change clears absPosCache', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frameId = graph.createNode('FRAME', page, {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    const absPos = graph.getAbsolutePosition(frameId)
    graph.updateNode(frameId, { paddingLeft: 20 })
    const absPos2 = graph.getAbsolutePosition(frameId)
    expect(absPos2).not.toBe(absPos)
  })

  test('layoutMode change clears absPosCache', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frameId = graph.createNode('FRAME', page, {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    const absPos = graph.getAbsolutePosition(frameId)
    graph.updateNode(frameId, { layoutMode: 'HORIZONTAL' as const })
    const absPos2 = graph.getAbsolutePosition(frameId)
    expect(absPos2).not.toBe(absPos)
  })

  test('mixed layout + non-layout change clears absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)
    // Change both x (layout) and fills (non-layout) simultaneously
    graph.updateNode(rId, { x: 50, fills: [] })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).toEqual({ x: 50, y: 20 })
    expect(absPos2).not.toBe(absPos)
  })

  test('non-layout properties: strokes, opacity, name, visible do not clear absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)

    graph.updateNode(rId, { strokes: [] })
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)

    graph.updateNode(rId, { opacity: 0.5 })
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)

    graph.updateNode(rId, { name: 'NewName' })
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)

    graph.updateNode(rId, { visible: false })
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)
  })

  test('empty changes object does not clear absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)
    graph.updateNode(rId, {})
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)
  })

  test('textPicture is nulled when text properties change on TEXT node', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'T',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    const textNode = graph.getNode(textId)
    expect(textNode).toBeDefined()
    // Simulate a cached textPicture
    const fakePicture = new Uint8Array([1, 2, 3])
    expectDefined(textNode, 'text node').textPicture = fakePicture

    // Changing fontSize (a TEXT_PICTURE_KEY) should null the cache
    graph.updateNode(textId, { fontSize: 24 })
    const afterUpdate = graph.getNode(textId)
    expect(afterUpdate).toBeDefined()
    expect(expectDefined(afterUpdate, 'updated node').textPicture).toBeNull()
  })

  test('figmaDerivedTextGlyphs are nulled when text rendering properties change on TEXT node', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'T',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    const glyphs = [{ commandsBlob: new Uint8Array([1, 2, 3]), x: 0, y: 10, fontSize: 14 }]
    const textNode = expectDefined(graph.getNode(textId), 'text node')
    textNode.figmaDerivedTextGlyphs = glyphs

    graph.updateNode(textId, { fontFamily: 'Noto Sans SC' })

    expect(expectDefined(graph.getNode(textId), 'updated node').figmaDerivedTextGlyphs).toBeNull()
  })

  test('advanced text rendering properties clear both text caches', () => {
    for (const [label, changes] of advancedTextInvalidationCases) {
      const graph = new SceneGraph()
      const page = pageId(graph)
      const textId = graph.createNode('TEXT', page, {
        name: `Advanced ${label}`,
        x: 0,
        y: 0,
        width: 100,
        height: 20
      }).id
      const textNode = expectDefined(graph.getNode(textId), 'text node')
      textNode.textPicture = new Uint8Array([1, 2, 3])
      textNode.figmaDerivedTextGlyphs = [
        { commandsBlob: new Uint8Array([4, 5, 6]), x: 0, y: 10, fontSize: 14 }
      ]

      graph.updateNode(textId, changes)

      const updated = expectDefined(graph.getNode(textId), `updated ${label} node`)
      expect([label, updated.textPicture]).toEqual([label, null])
      expect([label, updated.figmaDerivedTextGlyphs]).toEqual([label, null])
    }
  })

  test('figmaDerivedTextGlyphs survive non-text property change on TEXT node', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'T',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    const glyphs = [{ commandsBlob: new Uint8Array([4, 5, 6]), x: 0, y: 10, fontSize: 14 }]
    const textNode = expectDefined(graph.getNode(textId), 'text node')
    textNode.figmaDerivedTextGlyphs = glyphs

    graph.updateNode(textId, { opacity: 0.5 })

    expect(expectDefined(graph.getNode(textId), 'updated node').figmaDerivedTextGlyphs).toBe(glyphs)
  })

  test('fill updates clear textPicture but preserve imported glyph geometry', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'Imported text',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    const fakePicture = new Uint8Array([1, 2, 3])
    const glyphs = [{ commandsBlob: new Uint8Array([4, 5, 6]), x: 0, y: 10, fontSize: 14 }]
    const textNode = expectDefined(graph.getNode(textId), 'text node')
    textNode.textPicture = fakePicture
    textNode.figmaDerivedTextGlyphs = glyphs

    graph.updateNode(textId, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    const updated = expectDefined(graph.getNode(textId), 'updated node')
    expect(updated.textPicture).toBeNull()
    expect(updated.figmaDerivedTextGlyphs).toBe(glyphs)
  })

  test('range fill styleRuns updates clear textPicture but preserve imported glyph geometry', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'Range painted imported text',
      text: 'Import',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      styleRuns: [
        {
          start: 0,
          length: 6,
          style: { fontSize: 14 }
        }
      ]
    }).id
    const fakePicture = new Uint8Array([1, 2, 3])
    const glyphs = [{ commandsBlob: new Uint8Array([4, 5, 6]), x: 0, y: 10, fontSize: 14 }]
    const textNode = expectDefined(graph.getNode(textId), 'text node')
    textNode.textPicture = fakePicture
    textNode.figmaDerivedTextGlyphs = glyphs

    graph.updateNode(textId, {
      styleRuns: [
        { start: 0, length: 2, style: { fontSize: 14 } },
        {
          start: 2,
          length: 2,
          style: {
            fontSize: 14,
            fills: [
              { type: 'SOLID', color: { r: 0, g: 0.5, b: 1, a: 1 }, visible: true, opacity: 1 }
            ]
          }
        },
        { start: 4, length: 2, style: { fontSize: 14 } }
      ]
    })

    const updated = expectDefined(graph.getNode(textId), 'updated node')
    expect(updated.textPicture).toBeNull()
    expect(updated.figmaDerivedTextGlyphs).toBe(glyphs)
  })

  test('range font styleRuns updates clear imported glyph geometry', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'Range font imported text',
      text: 'Import',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      styleRuns: []
    }).id
    const textNode = expectDefined(graph.getNode(textId), 'text node')
    textNode.textPicture = new Uint8Array([1, 2, 3])
    textNode.figmaDerivedTextGlyphs = [
      { commandsBlob: new Uint8Array([4, 5, 6]), x: 0, y: 10, fontSize: 14 }
    ]

    graph.updateNode(textId, {
      styleRuns: [{ start: 0, length: 6, style: { fontFamily: 'Noto Sans SC' } }]
    })

    const updated = expectDefined(graph.getNode(textId), 'updated node')
    expect(updated.textPicture).toBeNull()
    expect(updated.figmaDerivedTextGlyphs).toBeNull()
  })

  test('preview fill updates clear textPicture but preserve imported glyph geometry', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'Preview imported text',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    const fakePicture = new Uint8Array([1, 2, 3])
    const glyphs = [{ commandsBlob: new Uint8Array([4, 5, 6]), x: 0, y: 10, fontSize: 14 }]
    const textNode = expectDefined(graph.getNode(textId), 'text node')
    textNode.textPicture = fakePicture
    textNode.figmaDerivedTextGlyphs = glyphs

    graph.updateNodePreview(textId, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })

    const updated = expectDefined(graph.getNode(textId), 'updated node')
    expect(updated.textPicture).toBeNull()
    expect(updated.figmaDerivedTextGlyphs).toBe(glyphs)
  })

  test('textPicture survives non-text property change on TEXT node', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'T',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    const fakePicture = new Uint8Array([4, 5, 6])
    const textNode = graph.getNode(textId)
    expect(textNode).toBeDefined()
    expectDefined(textNode, 'text node').textPicture = fakePicture

    // Changing opacity (NOT a TEXT_PICTURE_KEY) should preserve textPicture
    graph.updateNode(textId, { opacity: 0.5 })
    const afterUpdate = graph.getNode(textId)
    expect(afterUpdate).toBeDefined()
    expect(expectDefined(afterUpdate, 'updated node').textPicture).toBe(fakePicture)
  })

  test('textPicture is nulled when textPicture is already null', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'T',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    // textPicture starts as null — updateNode should not crash
    graph.updateNode(textId, { fontSize: 16 })
    const afterUpdate = graph.getNode(textId)
    expect(afterUpdate).toBeDefined()
    expect(expectDefined(afterUpdate, 'updated node').textPicture).toBeNull()
  })

  test('syncInstances clears stale text pictures when text props are copied', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const component = graph.createNode('COMPONENT', page, {
      name: 'Label component',
      x: 0,
      y: 0,
      width: 120,
      height: 40
    })
    const componentText = graph.createNode('TEXT', component.id, {
      text: 'Before',
      fontFamily: 'Inter',
      width: 120,
      height: 40
    })
    const instance = graph.createInstance(component.id, page)
    const instanceText = expectDefined(
      graph.getChildren(expectDefined(instance, 'instance').id)[0],
      'instance text'
    )
    instanceText.textPicture = new Uint8Array([1, 2, 3])
    instanceText.figmaDerivedTextGlyphs = []

    graph.updateNode(componentText.id, { text: 'After' })
    graph.syncInstances(component.id)

    const syncedText = expectDefined(graph.getNode(instanceText.id), 'synced text')
    expect(syncedText.text).toBe('After')
    expect(syncedText.textPicture).toBeNull()
    expect(syncedText.figmaDerivedTextGlyphs).toBeNull()
  })

  test('syncInstances preserves imported glyph geometry when only text fills change', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const component = graph.createNode('COMPONENT', page, {
      name: 'Painted label component',
      x: 0,
      y: 0,
      width: 120,
      height: 40
    })
    const componentText = graph.createNode('TEXT', component.id, {
      text: 'Imported',
      fontFamily: 'Unavailable Import Font',
      width: 120,
      height: 40
    })
    const instance = graph.createInstance(component.id, page)
    const instanceText = expectDefined(
      graph.getChildren(expectDefined(instance, 'instance').id)[0],
      'instance text'
    )
    const glyphs = [{ commandsBlob: new Uint8Array([7, 8, 9]), x: 0, y: 10, fontSize: 14 }]
    instanceText.textPicture = new Uint8Array([1, 2, 3])
    instanceText.figmaDerivedTextGlyphs = glyphs

    graph.updateNode(componentText.id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0.5, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.syncInstances(component.id)

    const syncedText = expectDefined(graph.getNode(instanceText.id), 'synced text')
    expect(syncedText.textPicture).toBeNull()
    expect(syncedText.figmaDerivedTextGlyphs).toBe(glyphs)
  })
})
