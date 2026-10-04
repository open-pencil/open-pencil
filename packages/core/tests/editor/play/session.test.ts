import { describe, expect, test } from 'bun:test'

import { emptyBehaviour } from '@open-pencil/core/behaviours'
import { createEditor } from '@open-pencil/core/editor'

/** A Switch set (State=On/Off) with a Switch behaviour, and an Off instance at (300, 100). */
function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const set = editor.graph.createNode('COMPONENT_SET', pageId, {
    name: 'Switch',
    width: 200,
    height: 80,
    componentPropertyDefinitions: [
      { id: 'state', name: 'State', type: 'VARIANT', defaultValue: 'Off', variantOptions: ['On', 'Off'] }
    ]
  })
  const on = editor.graph.createNode('COMPONENT', set.id, {
    name: 'State=On',
    width: 40,
    height: 20,
    componentPropertyValues: { State: 'On' }
  })
  editor.graph.createNode('RECTANGLE', on.id, { name: 'Knob', x: 20, width: 20, height: 20 })
  const off = editor.graph.createNode('COMPONENT', set.id, {
    name: 'State=Off',
    x: 60,
    width: 40,
    height: 20,
    componentPropertyValues: { State: 'Off' }
  })
  editor.graph.createNode('RECTANGLE', off.id, { name: 'Knob', width: 20, height: 20 })
  editor.setBehaviour(set.id, {
    ...emptyBehaviour('switch'),
    booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } }
  })
  const instance = editor.graph.createInstance(off.id, pageId, { x: 300, y: 100 })
  if (!instance) throw new Error('No instance')
  return { editor, on, off, instance }
}

describe('preview session', () => {
  test('clicking a switch flips a copy, never the document or its history', () => {
    const { editor, on, off, instance } = setup()
    const undoLabel = editor.undo.undoLabel
    editor.startPlay()
    expect(editor.playHitsControl(310, 110)).toBe(true)
    expect(editor.playHitsControl(10, 10)).toBe(false)

    expect(editor.playPointerDown(310, 110)).toBe(true)
    const substitute = editor.state.play?.substitutes.get(instance.id)
    expect(substitute?.graph.getNode(instance.id)?.componentId).toBe(on.id)
    expect(editor.graph.getNode(instance.id)?.componentId).toBe(off.id)
    expect(editor.undo.undoLabel).toBe(undoLabel)

    editor.playPointerDown(310, 110)
    expect(editor.state.play?.substitutes.get(instance.id)?.graph.getNode(instance.id)?.componentId).toBe(
      off.id
    )
  })

  test('reset drops the copies and leaving preview returns the canvas to editing', () => {
    const { editor, instance } = setup()
    editor.startPlay()
    editor.playPointerDown(310, 110)
    editor.resetPlay()
    expect(editor.state.play?.substitutes.has(instance.id)).toBe(false)
    editor.togglePlay()
    expect(editor.state.play).toBeNull()
  })
})
