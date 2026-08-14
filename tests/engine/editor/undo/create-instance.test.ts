import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

import { expectDefined } from '#tests/helpers/assert'

describe('create instance undo/redo', () => {
  test('places a nested component beside its world bounds on the page', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 500,
      y: 700,
      width: 300,
      height: 200
    })
    const component = editor.graph.createNode('COMPONENT', frame.id, {
      x: 40,
      y: 60,
      width: 100,
      height: 40
    })

    const instanceId = expectDefined(editor.createInstanceFromComponent(component.id), 'instanceId')
    const instance = expectDefined(editor.graph.getNode(instanceId), 'instance')

    expect(instance.parentId).toBe(pageId)
    expect({ x: instance.x, y: instance.y }).toEqual({ x: 680, y: 760 })
  })

  test('uses transformed world bounds for default placement', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 300,
      y: 200,
      width: 240,
      height: 180,
      rotation: 30
    })
    const component = editor.graph.createNode('COMPONENT', frame.id, {
      x: 25,
      y: 35,
      width: 90,
      height: 50,
      rotation: -15
    })
    const bounds = getAxisAlignedWorldBounds(component, editor.graph)

    const instanceId = expectDefined(editor.createInstanceFromComponent(component.id), 'instanceId')
    const instance = expectDefined(editor.graph.getNode(instanceId), 'instance')

    expect(instance.x).toBeCloseTo(bounds.x + bounds.width + 40)
    expect(instance.y).toBeCloseTo(bounds.y)
  })

  test('converts default world placement into a transformed destination parent', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const sourceFrame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 80,
      width: 300,
      height: 200
    })
    const component = editor.graph.createNode('COMPONENT', sourceFrame.id, {
      x: 30,
      y: 40,
      width: 80,
      height: 30
    })
    const destination = editor.graph.createNode('FRAME', pageId, {
      x: 500,
      y: 300,
      width: 240,
      height: 180,
      rotation: 90
    })
    const sourceBounds = getAxisAlignedWorldBounds(component, editor.graph)

    const instanceId = expectDefined(
      editor.createInstanceFromComponent(component.id, undefined, undefined, destination.id),
      'instanceId'
    )
    const instance = expectDefined(editor.graph.getNode(instanceId), 'instance')
    const instanceBounds = getAxisAlignedWorldBounds(instance, editor.graph)

    expect(instance.parentId).toBe(destination.id)
    expect(instanceBounds.x).toBeCloseTo(sourceBounds.x + sourceBounds.width + 40)
    expect(instanceBounds.y).toBeCloseTo(sourceBounds.y)

    editor.undo.undo()
    editor.undo.redo()
    const redone = expectDefined(editor.graph.getNode(instanceId), 'redone instance')
    const redoneBounds = getAxisAlignedWorldBounds(redone, editor.graph)
    expect(redoneBounds.x).toBeCloseTo(sourceBounds.x + sourceBounds.width + 40)
    expect(redoneBounds.y).toBeCloseTo(sourceBounds.y)
  })

  test('preserves explicit placement coordinates for drag and drop callers', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, { x: 500, y: 700 })
    const component = editor.graph.createNode('COMPONENT', frame.id, {
      x: 40,
      y: 60,
      width: 100,
      height: 40
    })

    const instanceId = expectDefined(
      editor.createInstanceFromComponent(component.id, 25, 35, frame.id),
      'instanceId'
    )
    const instance = expectDefined(editor.graph.getNode(instanceId), 'instance')

    expect({ x: instance.x, y: instance.y, parentId: instance.parentId }).toEqual({
      x: 25,
      y: 35,
      parentId: frame.id
    })
  })

  test('undo restores the previous selection instead of selecting the source component', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', pageId, {
      name: 'Library Button',
      width: 100,
      height: 40,
      internalOnly: true
    })
    const previous = editor.graph.createNode('RECTANGLE', pageId, { name: 'Previous selection' })

    editor.select([previous.id])
    const instanceId = expectDefined(
      editor.createInstanceFromComponent(component.id, 200, 100, pageId),
      'instanceId'
    )

    expect([...editor.state.selectedIds]).toEqual([instanceId])

    editor.undo.undo()

    expect(editor.graph.getNode(instanceId)).toBeUndefined()
    expect([...editor.state.selectedIds]).toEqual([previous.id])
  })
})
