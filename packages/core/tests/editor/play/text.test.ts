import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { emptyBehaviour, type Fill, type SceneNode } from '@open-pencil/scene-graph'

const fill: Fill = {
  type: 'SOLID',
  color: { r: 0.95, g: 0.95, b: 0.95, a: 1 },
  opacity: 1,
  visible: true
}

/** Let component sync, scheduled on a microtask, reach the instances. */
const synced = () => Promise.resolve()

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  /** A text layer showing the text property `propertyId`. */
  const label = (parentId: string, propertyId: string, text: string) =>
    editor.graph.createNode('TEXT', parentId, {
      name: 'Value',
      text,
      width: 100,
      height: 16,
      componentPropertyReferences: [{ propertyId, field: 'TEXT' }]
    })
  /** The text the canvas draws for an instance: its preview copy's, else its own. */
  const shownText = (instance: SceneNode) => {
    const graph = editor.state.play?.substitutes.get(instance.id)?.graph ?? editor.graph
    return graph.getChildren(instance.id).find((child) => child.type === 'TEXT')?.text
  }
  const shownComponent = (instance: SceneNode) =>
    (editor.state.play?.substitutes.get(instance.id)?.graph ?? editor.graph).getNode(instance.id)
      ?.componentId
  return { editor, pageId, label, shownText, shownComponent }
}

describe('text inputs in preview', () => {
  test('a text field takes typing and shows its placeholder again when emptied', async () => {
    const { editor, pageId, label, shownText, shownComponent } = setup()
    const set = editor.graph.createNode('COMPONENT_SET', pageId, {
      name: 'Field',
      y: 400,
      componentPropertyDefinitions: [
        {
          id: 'filled',
          name: 'Filled',
          type: 'VARIANT',
          defaultValue: 'No',
          variantOptions: ['No', 'Yes']
        },
        { id: 'value', name: 'Value', type: 'TEXT', defaultValue: 'Email' }
      ]
    })
    const [empty, filled] = ['No', 'Yes'].map((value, index) => {
      const variant = editor.graph.createNode('COMPONENT', set.id, {
        name: `Filled=${value}`,
        x: index * 200,
        width: 160,
        height: 30,
        fills: [fill],
        componentPropertyValues: { Filled: value }
      })
      label(variant.id, 'value', 'Email')
      return variant
    })
    editor.setBehaviour(set.id, {
      ...emptyBehaviour('textField'),
      texts: { value: { propertyId: 'value' } },
      booleans: { filled: { propertyId: 'filled', on: 'Yes', off: 'No' } }
    })
    const instance = editor.graph.createInstance(empty.id, pageId, { x: 300, y: 100 })
    if (!instance) throw new Error('No instance')
    await synced()
    editor.startPlay()

    // Nothing is focused yet, so typing goes nowhere.
    expect(editor.playKey('a')).toBe(false)
    editor.playPointerDown(310, 110)
    editor.playPointerUp()
    for (const key of ['H', 'i', '👋']) expect(editor.playKey(key)).toBe(true)
    expect(shownText(instance)).toBe('Hi👋')
    expect(shownComponent(instance)).toBe(filled.id)
    expect(editor.playKey('Enter')).toBe(false)
    expect(editor.playKey('Shift')).toBe(false)

    for (let index = 0; index < 3; index++) editor.playKey('Backspace')
    expect(shownText(instance)).toBe('Email')
    expect(shownComponent(instance)).toBe(empty.id)
    // A text field shows focus from a click, so Escape takes it off first.
    expect(editor.playBlur()).toBe(true)
    expect(editor.graph.getChildren(instance.id)[0]?.text).toBe('Email')
  })

  test('a number field steps from its parts and arrows and takes typed digits', async () => {
    const { editor, pageId, label, shownText } = setup()
    const component = editor.graph.createNode('COMPONENT', pageId, {
      name: 'Amount',
      y: 400,
      width: 120,
      height: 30,
      fills: [fill],
      componentPropertyDefinitions: [
        { id: 'text', name: 'Text', type: 'TEXT', defaultValue: '5' }
      ]
    })
    label(component.id, 'text', '5')
    const increment = editor.graph.createNode('FRAME', component.id, {
      name: 'Increment',
      x: 100,
      width: 20,
      height: 15,
      fills: [fill]
    })
    const decrement = editor.graph.createNode('FRAME', component.id, {
      name: 'Decrement',
      x: 100,
      y: 15,
      width: 20,
      height: 15,
      fills: [fill]
    })
    const parts = {
      increment: editor.convertToSlot(increment.id) ?? '',
      decrement: editor.convertToSlot(decrement.id) ?? ''
    }
    editor.setBehaviour(component.id, {
      ...emptyBehaviour('numberField'),
      texts: { text: { propertyId: 'text' } },
      numbers: { value: { min: 0, max: 10, step: 1, default: 5 } },
      parts
    })
    const instance = editor.graph.createInstance(component.id, pageId, { x: 300, y: 100 })
    if (!instance) throw new Error('No instance')
    await synced()
    editor.startPlay()

    editor.playPointerDown(410, 105)
    expect(shownText(instance)).toBe('6')
    editor.playPointerDown(410, 125)
    editor.playPointerDown(410, 125)
    expect(shownText(instance)).toBe('4')
    editor.playKey('ArrowUp', true)
    expect(shownText(instance)).toBe('10')

    editor.playKey('Backspace')
    editor.playKey('Backspace')
    editor.playKey('7')
    expect(shownText(instance)).toBe('7')
    editor.playKey('ArrowUp')
    expect(shownText(instance)).toBe('8')
    expect(editor.playKey('x')).toBe(false)
  })
})
