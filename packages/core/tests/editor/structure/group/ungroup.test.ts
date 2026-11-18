import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

// Recorded in Figma desktop 126 with ⌘⇧G (scratch/pr-oracle/grouping): Ungroup takes apart
// groups, frames, booleans, and sections, keeps every child where it is on the canvas, and drops
// the container's own look.

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const node = (
    type: Parameters<typeof editor.graph.createNode>[0],
    parentId: string,
    props: Parameters<typeof editor.graph.createNode>[2] = {}
  ) => editor.graph.createNode(type, parentId, { width: 40, height: 30, ...props })
  const names = (parentId: string) => editor.graph.getChildren(parentId).map((child) => child.name)
  const selectedNames = () =>
    [...editor.state.selectedIds].map((id) => editor.graph.getNode(id)?.name)
  return { editor, pageId, node, names, selectedNames }
}

describe('ungroupSelected', () => {
  test('takes a frame apart in its place, keeping children where they are', () => {
    const { editor, pageId, node, names, selectedNames } = setup()
    node('RECTANGLE', pageId, { name: 'Below' })
    const frame = node('FRAME', pageId, { name: 'F', x: 50, y: 50, width: 200, height: 150 })
    editor.graph.updateNode(frame.id, { opacity: 0.5, clipsContent: true, cornerRadius: 12 })
    const a = node('RECTANGLE', frame.id, { name: 'A', x: 10, y: 10 })
    const b = node('RECTANGLE', frame.id, { name: 'B', x: 180, y: 130 })
    editor.graph.updateNode(b.id, { horizontalConstraint: 'MAX', verticalConstraint: 'MAX' })
    node('RECTANGLE', pageId, { name: 'Above' })

    editor.select([frame.id])
    expect(editor.canUngroupSelection()).toBe(true)
    editor.ungroupSelected()

    expect(names(pageId)).toEqual(['Below', 'A', 'B', 'Above'])
    expect(editor.graph.getNode(frame.id)).toBeUndefined()
    expect(editor.graph.getAbsolutePosition(a.id)).toEqual({ x: 60, y: 60 })
    expect(editor.graph.getAbsolutePosition(b.id)).toEqual({ x: 230, y: 180 })
    // The children keep their own props; the frame's opacity is not pushed down.
    expect(editor.graph.getNode(a.id)?.opacity).toBe(1)
    expect(editor.graph.getNode(b.id)?.horizontalConstraint).toBe('MAX')
    expect(selectedNames()).toEqual(['A', 'B'])

    editor.undoAction()
    expect(names(pageId)).toEqual(['Below', 'F', 'Above'])
    expect(names(frame.id)).toEqual(['A', 'B'])
    expect(editor.graph.getNode(frame.id)?.opacity).toBe(0.5)
    expect(selectedNames()).toEqual(['F'])

    editor.redoAction()
    expect(names(pageId)).toEqual(['Below', 'A', 'B', 'Above'])
    expect(selectedNames()).toEqual(['A', 'B'])
  })

  test('carries a rotated frame’s turn into its children', () => {
    const { editor, pageId, node } = setup()
    const frame = node('FRAME', pageId, { x: 100, y: 100, width: 200, height: 100, rotation: 30 })
    const a = node('RECTANGLE', frame.id, { x: 10, y: 10 })
    const before = editor.graph.getAbsolutePosition(a.id)

    editor.select([frame.id])
    editor.ungroupSelected()

    const after = editor.graph.getAbsolutePosition(a.id)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
    expect(editor.graph.getNode(a.id)?.rotation).toBeCloseTo(30, 6)
  })

  test('takes apart every selected container, keeping other layers selected', () => {
    const { editor, pageId, node, names, selectedNames } = setup()
    const group = editor.graph.createNode('GROUP', pageId, { name: 'G' })
    node('RECTANGLE', group.id, { name: 'A' })
    const frame = node('FRAME', pageId, { name: 'F', width: 100, height: 100 })
    node('RECTANGLE', frame.id, { name: 'C' })
    const rect = node('RECTANGLE', pageId, { name: 'R', x: 200 })

    editor.select([group.id, frame.id, rect.id])
    editor.ungroupSelected()

    expect(names(pageId)).toEqual(['A', 'C', 'R'])
    expect(selectedNames().toSorted()).toEqual(['A', 'C', 'R'])
    editor.undoAction()
    expect(names(pageId)).toEqual(['G', 'F', 'R'])
  })

  test('takes booleans and sections apart but leaves components, instances, and shapes', () => {
    const { editor, pageId, node, names } = setup()
    const boolean = editor.graph.createNode('BOOLEAN_OPERATION', pageId, { name: 'Bool' })
    node('RECTANGLE', boolean.id, { name: 'A' })
    const section = node('SECTION', pageId, { name: 'S', width: 300, height: 200 })
    node('RECTANGLE', section.id, { name: 'B' })
    const component = node('COMPONENT', pageId, { name: 'Comp', width: 100, height: 100 })
    node('RECTANGLE', component.id, { name: 'C' })
    const instance = editor.graph.createInstance(component.id, pageId, { name: 'Inst' })
    const rect = node('RECTANGLE', pageId, { name: 'R' })

    for (const id of [component.id, instance?.id ?? '', rect.id]) {
      editor.select([id])
      expect(editor.canUngroupSelection()).toBe(false)
    }

    editor.select([boolean.id, section.id])
    editor.ungroupSelected()
    expect(names(pageId)).toEqual(['A', 'B', 'Comp', 'Inst', 'R'])
  })

  test('refuses a frame in the locked part of an instance', () => {
    const { editor, pageId, node } = setup()
    const component = node('COMPONENT', pageId, { width: 200, height: 150 })
    const inner = node('FRAME', component.id, { name: 'Inner', width: 120, height: 80 })
    node('RECTANGLE', inner.id)
    const instance = editor.graph.createInstance(component.id, pageId)
    const [copy] = editor.graph.getChildren(instance?.id ?? '')

    editor.select([copy?.id ?? ''])
    expect(editor.canUngroupSelection()).toBe(false)
    editor.ungroupSelected()
    expect(editor.graph.getChildren(instance?.id ?? '').map((child) => child.name)).toEqual([
      'Inner'
    ])
  })

  test('lets the children of a frame in an auto layout join its flow', () => {
    const { editor, pageId, node, names } = setup()
    const column = node('FRAME', pageId, { name: 'Column', width: 300, height: 400 })
    editor.graph.updateNode(column.id, {
      layoutMode: 'VERTICAL',
      itemSpacing: 10,
      paddingTop: 10,
      paddingLeft: 10
    })
    node('RECTANGLE', column.id, { name: 'Top' })
    const frame = node('FRAME', column.id, { name: 'F', width: 200, height: 80 })
    node('RECTANGLE', frame.id, { name: 'A', x: 10, y: 10 })
    node('RECTANGLE', frame.id, { name: 'B', x: 100, y: 40 })
    node('RECTANGLE', column.id, { name: 'Bottom' })
    editor.select([frame.id])

    editor.ungroupSelected()

    // Figma: Top 10,10 · A 10,50 · B 10,90 · Bottom 10,130.
    expect(names(column.id)).toEqual(['Top', 'A', 'B', 'Bottom'])
    expect(editor.graph.getChildren(column.id).map((child) => [child.x, child.y])).toEqual([
      [10, 10],
      [10, 50],
      [10, 90],
      [10, 130]
    ])
  })

  test('places an absolutely placed child of an auto layout in the flow it lands in', () => {
    const { editor, pageId, node } = setup()
    const row = node('FRAME', pageId, { width: 300, height: 100 })
    editor.graph.updateNode(row.id, { layoutMode: 'HORIZONTAL' })
    const b = node('RECTANGLE', row.id, { name: 'B', x: 200, y: 50 })
    editor.graph.updateNode(b.id, { layoutPositioning: 'ABSOLUTE' })

    editor.select([row.id])
    editor.ungroupSelected()

    expect(editor.graph.getNode(b.id)?.layoutPositioning).toBe('AUTO')
    expect(editor.graph.getAbsolutePosition(b.id)).toEqual({ x: 200, y: 50 })
  })
})
