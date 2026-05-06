import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { pageId, rect } from './helpers'

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
})
