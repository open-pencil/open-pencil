import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  emptyBehaviour,
  guessInteractionStates,
  type BehaviourKind,
  type Fill,
  type SceneNode
} from '@open-pencil/scene-graph'

const fill: Fill = {
  type: 'SOLID',
  color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
  opacity: 1,
  visible: true
}

/**
 * A component set with a variant for every combination of `properties`, each 80×30, and the
 * behaviour `kind` with its interaction states drawn by the `Interaction` property.
 */
function controlSet(kind: BehaviourKind, properties: Record<string, string[]>) {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const names = Object.keys(properties)
  const set = editor.graph.createNode('COMPONENT_SET', pageId, {
    name: kind,
    componentPropertyDefinitions: names.map((name) => ({
      id: name.toLowerCase(),
      name,
      type: 'VARIANT' as const,
      defaultValue: properties[name][0],
      variantOptions: properties[name]
    }))
  })
  const combinations = names.reduce<Record<string, string>[]>(
    (all, name) => all.flatMap((values) => properties[name].map((v) => ({ ...values, [name]: v }))),
    [{}]
  )
  const variants = combinations.map((values, index) =>
    editor.graph.createNode('COMPONENT', set.id, {
      name: Object.entries(values)
        .map(([name, value]) => `${name}=${value}`)
        .join(', '),
      x: index * 100,
      width: 80,
      height: 30,
      fills: [fill],
      componentPropertyValues: values
    })
  )
  const variant = (values: Record<string, string>) => {
    const found = variants.find((item) =>
      Object.entries(values).every(([name, value]) => item.componentPropertyValues[name] === value)
    )
    if (!found) throw new Error(`No variant ${JSON.stringify(values)}`)
    return found
  }
  const place = (values: Record<string, string>, y: number) => {
    const instance = editor.graph.createInstance(variant(values).id, pageId, { x: 300, y })
    if (!instance) throw new Error('No instance')
    return instance
  }
  /** The component the canvas draws for an instance: its preview copy's, else its own. */
  const shown = (instance: SceneNode) =>
    editor.state.play?.substitutes.get(instance.id)?.graph.getNode(instance.id)?.componentId ??
    instance.componentId
  return { editor, set, variant, place, shown }
}

const INTERACTION = ['Default', 'Hover', 'Pressed', 'Focus', 'Disabled']

function buttons() {
  const control = controlSet('button', { Interaction: INTERACTION })
  control.editor.setBehaviour(control.set.id, {
    ...emptyBehaviour('button'),
    states: guessInteractionStates('interaction', INTERACTION)
  })
  const first = control.place({ Interaction: 'Default' }, 100)
  const second = control.place({ Interaction: 'Default' }, 200)
  const disabled = control.place({ Interaction: 'Disabled' }, 300)
  control.editor.startPlay()
  return { ...control, first, second, disabled }
}

describe('interaction states in preview', () => {
  test('hovering and pressing switch to the hover and pressed variants', () => {
    const { editor, variant, first, shown } = buttons()
    expect(editor.playPointerMove(310, 110)).toBe(true)
    expect(shown(first)).toBe(variant({ Interaction: 'Hover' }).id)

    editor.playPointerDown(310, 110)
    expect(shown(first)).toBe(variant({ Interaction: 'Pressed' }).id)
    editor.playPointerUp()
    expect(shown(first)).toBe(variant({ Interaction: 'Hover' }).id)

    editor.playPointerMove(10, 10)
    expect(shown(first)).toBe(variant({ Interaction: 'Default' }).id)
    expect(editor.graph.getNode(first.id)?.componentId).toBe(variant({ Interaction: 'Default' }).id)
  })

  test('a disabled instance ignores the pointer and Tab skips it', () => {
    const { editor, variant, first, second, disabled, shown } = buttons()
    expect(editor.playPointerMove(310, 310)).toBe(false)
    expect(editor.playPointerDown(310, 310)).toBe(false)
    expect(shown(disabled)).toBe(variant({ Interaction: 'Disabled' }).id)

    expect(editor.playKey('Tab')).toBe(true)
    expect(shown(first)).toBe(variant({ Interaction: 'Focus' }).id)
    editor.playKey('Tab')
    expect(shown(first)).toBe(variant({ Interaction: 'Default' }).id)
    expect(shown(second)).toBe(variant({ Interaction: 'Focus' }).id)
    editor.playKey('Tab')
    expect(shown(first)).toBe(variant({ Interaction: 'Focus' }).id)
    editor.playKey('Tab', true)
    expect(shown(second)).toBe(variant({ Interaction: 'Focus' }).id)

    expect(editor.playBlur()).toBe(true)
    expect(shown(second)).toBe(variant({ Interaction: 'Default' }).id)
    expect(editor.playBlur()).toBe(false)
  })

  test('a click focuses without showing focus, and Space then uses the control', () => {
    const control = controlSet('switch', {
      State: ['Off', 'On'],
      Interaction: ['Default', 'Hover', 'Focus']
    })
    const { editor, set, variant, place, shown } = control
    editor.setBehaviour(set.id, {
      ...emptyBehaviour('switch'),
      booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } },
      states: guessInteractionStates('interaction', ['Default', 'Hover', 'Focus'])
    })
    const instance = place({ State: 'Off', Interaction: 'Default' }, 100)
    editor.startPlay()

    editor.playPointerDown(310, 110)
    editor.playPointerUp()
    expect(shown(instance)).toBe(variant({ State: 'On', Interaction: 'Hover' }).id)
    editor.playPointerMove(10, 10)
    expect(shown(instance)).toBe(variant({ State: 'On', Interaction: 'Default' }).id)

    expect(editor.playKey(' ')).toBe(true)
    expect(shown(instance)).toBe(variant({ State: 'Off', Interaction: 'Default' }).id)
    // Focus from a click is not shown, so Escape leaves it; a click elsewhere drops it.
    expect(editor.playBlur()).toBe(false)
    editor.playPointerDown(10, 10)
    expect(editor.playKey(' ')).toBe(false)
  })

  test('a value change keeps the state when the set draws it, and falls back to rest otherwise', () => {
    const control = controlSet('switch', { State: ['Off', 'On'], Interaction: ['Default', 'Hover'] })
    const { editor, set, variant, shown } = control
    // The set has no On variant drawn hovered.
    editor.graph.deleteNode(variant({ State: 'On', Interaction: 'Hover' }).id)
    editor.setBehaviour(set.id, {
      ...emptyBehaviour('switch'),
      booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } },
      states: guessInteractionStates('interaction', ['Default', 'Hover'])
    })
    const instance = control.place({ State: 'Off', Interaction: 'Default' }, 100)
    editor.startPlay()

    editor.playPointerMove(310, 110)
    expect(shown(instance)).toBe(variant({ State: 'Off', Interaction: 'Hover' }).id)
    editor.playPointerDown(310, 110)
    expect(shown(instance)).toBe(variant({ State: 'On', Interaction: 'Default' }).id)
  })
})
