import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { instanceSlotFrames, slotPropertyId } from '@open-pencil/scene-graph'

/** A Card component with a Body frame holding Default, and an instance of it. */
function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('COMPONENT', pageId, { name: 'Card' })
  const title = editor.graph.createNode('TEXT', card.id, { name: 'Title', text: 'Title' })
  const body = editor.graph.createNode('FRAME', card.id, { name: 'Body' })
  editor.graph.createNode('TEXT', body.id, { name: 'Default', text: 'Default' })
  const instance = editor.graph.createInstance(card.id, pageId)
  if (!instance) throw new Error('No instance')
  return { editor, card, title, body, instance }
}

/** Let component sync, scheduled on a microtask, reach the instances. */
const synced = () => Promise.resolve()

describe('authoring slots', () => {
  test('converting a frame defines a slot that existing instances pick up', async () => {
    const { editor, card, body, instance } = setup()
    const id = editor.convertToSlot(body.id)
    await synced()

    expect(card.componentPropertyDefinitions).toEqual([
      expect.objectContaining({ id, name: 'Body', type: 'SLOT' })
    ])
    expect(slotPropertyId(body)).toBe(id ?? '')
    expect(instanceSlotFrames(editor.graph, instance).map((frame) => frame.name)).toEqual(['Body'])

    editor.undo.undo()
    await synced()
    expect(editor.graph.getNode(card.id)?.componentPropertyDefinitions).toEqual([])
    expect(instanceSlotFrames(editor.graph, instance)).toEqual([])
  })

  test('other layers are wrapped in a new slot frame in one undo step', () => {
    const { editor, card, title } = setup()
    editor.select([title.id])
    const id = editor.createSlot()
    const frame = editor.graph.getChildren(card.id).find((child) => slotPropertyId(child) === id)
    expect(frame?.name).toBe('Slot')
    expect(editor.graph.getChildren(frame?.id ?? '').map((child) => child.name)).toEqual(['Title'])

    editor.undo.undo()
    expect(editor.graph.getNode(title.id)?.parentId).toBe(card.id)
    expect(editor.graph.getNode(card.id)?.componentPropertyDefinitions).toEqual([])
  })

  test('layers outside a main component or inside an instance cannot become slots', () => {
    const { editor, instance } = setup()
    const instanceBody = editor.graph.getChildren(instance.id).find((c) => c.type === 'FRAME')
    if (!instanceBody) throw new Error('Missing instance frame')
    editor.select([instance.id])
    expect(editor.createSlot()).toBeNull()
    expect(editor.convertToSlot(instanceBody.id)).toBeNull()
  })

  test('settings change and undo as one step', () => {
    const { editor, card, body } = setup()
    const id = editor.convertToSlot(body.id) ?? ''
    editor.updateSlot(card.id, id, {
      name: 'Content',
      slotSettings: { maxChildren: 2, allowPreferredValuesOnly: true }
    })
    expect(editor.graph.getNode(card.id)?.componentPropertyDefinitions[0]).toMatchObject({
      name: 'Content',
      slotSettings: { maxChildren: 2, allowPreferredValuesOnly: true }
    })
    editor.undo.undo()
    expect(editor.graph.getNode(card.id)?.componentPropertyDefinitions[0]).toMatchObject({
      name: 'Body',
      slotSettings: { allowPreferredValuesOnly: false }
    })
  })

  test('removing a slot frees the frame and drops instance content until undone', async () => {
    const { editor, card, body, instance } = setup()
    const id = editor.convertToSlot(body.id) ?? ''
    await synced()
    const [frame] = instanceSlotFrames(editor.graph, instance)
    editor.clearSlot(frame.id)
    expect(editor.graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({ [id]: '' })

    editor.removeSlot(card.id, id)
    await synced()
    expect(editor.graph.getNode(card.id)?.componentPropertyDefinitions).toEqual([])
    expect(slotPropertyId(body)).toBeUndefined()
    expect(editor.graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({})

    editor.undo.undo()
    await synced()
    expect(editor.graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({ [id]: '' })
    const restoredInstance = editor.graph.getNode(instance.id)
    if (!restoredInstance) throw new Error('Missing instance after undo')
    const [restored] = instanceSlotFrames(editor.graph, restoredInstance)
    expect(editor.graph.getChildren(restored.id)).toEqual([])
  })
})
