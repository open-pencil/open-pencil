import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  emptyBehaviour,
  instanceMainComponent,
  instanceSlotFrames,
  type Behaviour,
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

/** Let component sync, scheduled on a microtask, reach the instances. */
const synced = () => Promise.resolve()

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const frame = (parentId: string, props: Partial<SceneNode>) =>
    editor.graph.createNode('FRAME', parentId, { fills: [fill], ...props })

  /** A set with Checked=Off and Checked=On, 20×20, behaving as `kind` through Checked. */
  function checkable(kind: BehaviourKind) {
    const set = editor.graph.createNode('COMPONENT_SET', pageId, {
      name: kind,
      y: 500,
      componentPropertyDefinitions: [
        {
          id: 'checked',
          name: 'Checked',
          type: 'VARIANT',
          defaultValue: 'Off',
          variantOptions: ['Off', 'On']
        }
      ]
    })
    const [off, on] = ['Off', 'On'].map((value, index) =>
      editor.graph.createNode('COMPONENT', set.id, {
        name: `Checked=${value}`,
        x: index * 40,
        width: 20,
        height: 20,
        fills: [fill],
        componentPropertyValues: { Checked: value }
      })
    )
    editor.setBehaviour(set.id, {
      ...emptyBehaviour(kind),
      booleans: { value: { propertyId: 'checked', on: 'On', off: 'Off' } }
    })
    return { off, on }
  }

  /**
   * A main component behaving as `kind` whose Items slot holds `items` side by side, 30 apart,
   * and an instance of it at (300, 100).
   */
  async function group(kind: BehaviourKind, items: SceneNode[]) {
    const component = editor.graph.createNode('COMPONENT', pageId, {
      name: kind,
      y: 800,
      width: 200,
      height: 60
    })
    const slot = frame(component.id, { name: 'Items', width: 200, height: 60, fills: [] })
    for (const [index, item] of items.entries())
      editor.graph.createInstance(item.id, slot.id, { x: index * 30 })
    const items_ = editor.convertToSlot(slot.id)
    editor.setBehaviour(component.id, { ...emptyBehaviour(kind), parts: { items: items_ ?? '' } })
    const instance = editor.graph.createInstance(component.id, pageId, { x: 300, y: 100 })
    if (!instance) throw new Error('No instance')
    await synced()
    editor.startPlay()
    const [frameInInstance] = instanceSlotFrames(editor.graph, instance)
    const children = () => frameInInstance?.childIds ?? []
    /** The main components the canvas draws for the instance's items. */
    const shown = () =>
      children().map((id) => {
        const copies = editor.state.play?.substitutes.get(instance.id)?.graph ?? editor.graph
        const node = copies.getNode(id)
        if (!node) return undefined
        return (instanceMainComponent(copies, node) ?? instanceMainComponent(editor.graph, node))
          ?.id
      })
    /** The visibility of each item's Content frame, as drawn. */
    const contentShown = () =>
      children().map((id) => {
        const copies = editor.state.play?.substitutes.get(instance.id)?.graph ?? editor.graph
        const content = copies.getChildren(id).find((child) => child.name === 'Content')
        return content?.visible
      })
    return { instance, shown, contentShown }
  }

  return { editor, pageId, frame, checkable, group }
}

describe('grouped controls in preview', () => {
  test('a radio group turns on the pressed radio and arrows move the choice', async () => {
    const { editor, checkable, group } = setup()
    const { off, on } = checkable('radio')
    const { shown } = await group('radioGroup', [off, off, off])

    editor.playPointerDown(335, 105)
    expect(shown()).toEqual([off.id, on.id, off.id])
    editor.playPointerDown(365, 105)
    expect(shown()).toEqual([off.id, off.id, on.id])
    // Pressing the radio that is on keeps it on.
    editor.playPointerDown(365, 105)
    expect(shown()).toEqual([off.id, off.id, on.id])
    expect(editor.playKey('ArrowRight')).toBe(true)
    expect(shown()).toEqual([on.id, off.id, off.id])
    // The document's radios never change.
    expect(editor.graph.getNode(off.id)?.componentPropertyValues.Checked).toBe('Off')
  })

  test('a toggle group turns on at most one toggle, and pressing it again turns it off', async () => {
    const { editor, checkable, group } = setup()
    const { off, on } = checkable('toggle')
    const { shown } = await group('toggleGroup', [off, on, off])

    editor.playPointerDown(305, 105)
    expect(shown()).toEqual([on.id, off.id, off.id])
    editor.playPointerDown(305, 105)
    expect(shown()).toEqual([off.id, off.id, off.id])
  })

  test('an accordion opens one collapsible at a time from its trigger', async () => {
    const { editor, pageId, frame, group } = setup()
    const collapsible = editor.graph.createNode('COMPONENT', pageId, {
      name: 'Item',
      y: 600,
      width: 25,
      height: 60
    })
    const trigger = frame(collapsible.id, { name: 'Trigger', width: 25, height: 20 })
    const content = frame(collapsible.id, {
      name: 'Content',
      y: 20,
      width: 25,
      height: 40,
      visible: false
    })
    const parts = {
      trigger: editor.convertToSlot(trigger.id) ?? '',
      content: editor.convertToSlot(content.id) ?? ''
    }
    editor.setBehaviour(collapsible.id, {
      ...emptyBehaviour('collapsible'),
      parts
    } satisfies Behaviour)
    const { contentShown } = await group('accordion', [collapsible, collapsible, collapsible])

    // A press on an item's content is not on its trigger.
    editor.playPointerDown(335, 140)
    expect(contentShown()).toEqual([false, false, false])
    editor.playPointerDown(335, 105)
    expect(contentShown()).toEqual([false, true, false])
    editor.playPointerDown(305, 105)
    expect(contentShown()).toEqual([true, false, false])
    editor.playPointerDown(305, 105)
    expect(contentShown()).toEqual([false, false, false])
  })
})
