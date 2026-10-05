import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { ownsSlotContent, slotPropertyId, type SceneNode } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'

/** A Card component whose `Body` slot holds `Default`, an instance of it, and a free layer. */
function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('COMPONENT', pageId, {
    name: 'Card',
    componentPropertyDefinitions: [
      { id: 'card:body', name: 'Body', type: 'SLOT', defaultValue: '' }
    ]
  })
  editor.graph.createNode('TEXT', card.id, { name: 'Title', text: 'Title' })
  const body = editor.graph.createNode('FRAME', card.id, {
    name: 'Body',
    componentPropertyReferences: [{ propertyId: 'card:body', field: 'SLOT_CONTENT' }]
  })
  editor.graph.createNode('TEXT', body.id, { name: 'Default', text: 'Default' })
  const item = editor.graph.createNode('COMPONENT', pageId, { name: 'Item' })
  const instance = editor.graph.createInstance(card.id, pageId)
  if (!instance) throw new Error('No instance')
  const free = editor.graph.createNode('RECTANGLE', pageId, { name: 'Free' })
  const slot = editor.graph.getChildren(instance.id).find((child) => slotPropertyId(child))
  const title = editor.graph.getChildren(instance.id).find((child) => child.name === 'Title')
  if (!slot || !title) throw new Error('Missing instance layers')
  return { editor, pageId, card, item, instance, free, slot, title }
}

const names = (editor: ReturnType<typeof createEditor>, node: SceneNode) =>
  editor.graph.getChildren(node.id).map((child) => child.name)

describe('editing instance slots', () => {
  test('a shape created in a slot claims it, and the rest of the instance refuses one', () => {
    const { editor, instance, slot } = setup()
    editor.createShape('RECTANGLE', 0, 0, 10, 10, slot.id, 'Drawn')
    expect(names(editor, slot)).toContain('Drawn')
    expect(ownsSlotContent(editor.graph, slot, 'card:body')).toBe(true)

    const before = editor.graph.nodes.size
    expect(() => editor.createShape('RECTANGLE', 0, 0, 10, 10, instance.id)).toThrow()
    expect(editor.graph.nodes.size).toBe(before)
  })

  test('moving a layer into an untouched slot claims it, and one undo restores both', () => {
    const { editor, pageId, instance, free, slot } = setup()
    // As the canvas does: reparent on drop, then record the move.
    editor.undo.runBatch('Move', () => {
      editor.reparentNodes([free.id], slot.id)
      editor.commitMoveWithReparent(new Map([[free.id, { x: 0, y: 0, parentId: pageId }]]))
    })

    expect(names(editor, slot)).toEqual(['Default', 'Free'])
    expect(ownsSlotContent(editor.graph, slot)).toBe(true)
    expect(instance.componentPropertyAssignments).toEqual({ 'card:body': '' })

    editor.undo.undo()
    const restored = editor.graph.getChildren(instance.id).find((child) => slotPropertyId(child))
    if (!restored) throw new Error('Missing slot after undo')
    expect(names(editor, restored)).toEqual(['Default'])
    expect(editor.graph.getNode(free.id)?.parentId).toBe(pageId)
    expect(editor.graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({})
  })

  test('the rest of an instance refuses layers', () => {
    const { editor, pageId, instance, free, title } = setup()
    expect(editor.reparentNodes([free.id], instance.id)).toBe(false)
    expect(editor.graph.getNode(free.id)?.parentId).toBe(pageId)
    expect(editor.acceptsChildren(instance.id)).toBe(false)
    expect(editor.acceptingParent(title.id)).toBe(pageId)
  })

  test('paste with the instance selected lands beside it, and with the slot selected inside it', async () => {
    const { editor, pageId, instance, free, slot } = setup()
    editor.select([free.id])
    const payload = await editor.prepareCopy()
    if (!payload.snapshot) throw new Error('Missing snapshot')
    editor.select([instance.id])
    await editor.pasteSnapshot(payload.snapshot)
    expect(editor.graph.getChildren(pageId).filter((node) => node.name === 'Free')).toHaveLength(2)
    editor.select([slot.id])
    await editor.pasteSnapshot(payload.snapshot)
    expect(names(editor, slot)).toEqual(['Default', 'Free'])
  })

  test('reset, delete contents, and add instance are single undo steps', () => {
    const { editor, item, instance, slot } = setup()
    editor.clearSlot(slot.id)
    expect(names(editor, slot)).toEqual([])

    const added = expectDefined(editor.addInstanceToSlot(slot.id, item.id), 'added')
    expect(added && editor.graph.getNode(added)?.componentId).toBe(item.id)
    expect(names(editor, slot)).toEqual(['Item'])

    editor.resetSlot(slot.id)
    const current = () => {
      const frame = editor.graph.getChildren(instance.id).find((child) => slotPropertyId(child))
      if (!frame) throw new Error('Missing slot')
      return frame
    }
    expect(names(editor, current())).toEqual(['Default'])
    expect(editor.graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({})

    editor.undo.undo()
    expect(names(editor, current())).toEqual(['Item'])
    editor.undo.undo()
    expect(names(editor, current())).toEqual([])
  })
  test('layers in the rest of an instance cannot be grouped or wrapped', () => {
    const { editor, instance, title } = setup()
    editor.select([title.id])
    editor.groupSelected()
    editor.wrapInAutoLayout()
    expect(editor.graph.getNode(title.id)?.parentId).toBe(instance.id)
  })

  test('undoing an added instance restores the selection', () => {
    const { editor, item, slot, free } = setup()
    editor.select([free.id])
    const added = expectDefined(editor.addInstanceToSlot(slot.id, item.id), 'added')
    expect([...editor.state.selectedIds]).toEqual([added])
    editor.undo.undo()
    expect([...editor.state.selectedIds]).toEqual([free.id])
    editor.undo.redo()
    expect([...editor.state.selectedIds]).toEqual([added])
  })
  test('delete leaves the rest of an instance alone and claims a slot in one undo step', () => {
    const { editor, instance, slot, title } = setup()
    editor.select([title.id])
    editor.deleteSelected()
    expect(editor.graph.getNode(title.id)?.parentId).toBe(instance.id)

    const [content] = editor.graph.getChildren(slot.id)
    editor.select([content.id])
    editor.deleteSelected()
    expect(editor.graph.getChildren(slot.id)).toEqual([])
    expect(editor.graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({
      'card:body': ''
    })
    editor.undo.undo()
    const restored = editor.graph.getChildren(instance.id).find((child) => slotPropertyId(child))
    expect(restored && names(editor, restored)).toEqual(['Default'])
    expect(editor.graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({})
  })
})
