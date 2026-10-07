import { describe, expect, test } from 'bun:test'

import { createEditor, playIslandRoots, resolvePlayState } from '@open-pencil/core/editor'
import {
  emptyBehaviour,
  instanceMainComponent,
  layerPath,
  SceneGraph
} from '@open-pencil/scene-graph'

/** A Switch set (State × Interaction) and a card frame holding an Off instance with a label. */
function switchCard() {
  const editor = createEditor()
  const graph = editor.graph
  const pageId = editor.state.currentPageId
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Switch',
    componentPropertyDefinitions: [
      { id: 'state', name: 'State', type: 'VARIANT', defaultValue: 'Off', variantOptions: ['Off', 'On'] },
      {
        id: 'interaction',
        name: 'Interaction',
        type: 'VARIANT',
        defaultValue: 'Default',
        variantOptions: ['Default', 'Hover']
      }
    ]
  })
  const variant = (state: string, interaction: string) =>
    graph.createNode('COMPONENT', set.id, {
      name: `State=${state}, Interaction=${interaction}`,
      componentPropertyValues: { State: state, Interaction: interaction }
    })
  const off = variant('Off', 'Default')
  const on = variant('On', 'Default')
  const offHover = variant('Off', 'Hover')
  editor.setBehaviour(set.id, {
    ...emptyBehaviour('switch'),
    booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } }
  })
  const card = graph.createNode('FRAME', pageId, { name: 'Card', x: 400 })
  const instance = graph.createInstance(off.id, card.id)
  if (!instance) throw new Error('No instance')
  graph.updateNode(instance.id, { name: 'Wifi' })
  graph.createNode('FRAME', pageId, { name: 'Empty', x: 800 })
  return { graph, pageId, card, instance, off, on, offHover }
}

describe('preview islands', () => {
  test('a top-level layer holding a control is an island; main components and empty layers are not', () => {
    const { graph, pageId, card } = switchCard()
    expect(playIslandRoots(graph, pageId)).toEqual([card.id])
  })

  test('a state shows the matching variant on a private copy and leaves the document alone', () => {
    const { graph, card, instance, off, on } = switchCard()
    const path = layerPath(graph, card.id, instance.id)
    expect(path).toBe('Wifi')

    const shown = resolvePlayState(graph, card.id, new Map([[path, { variants: { State: 'On' } }]]))
    const copy = shown.getChildren(card.id)[0]
    expect(copy && instanceMainComponent(shown, copy)?.id).toBe(on.id)
    expect(instanceMainComponent(graph, instance)?.id).toBe(off.id)
  })

  test('a preferred state shows only where the set draws it with the required values', () => {
    const { graph, card, instance, on, offHover } = switchCard()
    const path = layerPath(graph, card.id, instance.id)
    const shownWith = (state: string) => {
      const shown = resolvePlayState(
        graph,
        card.id,
        new Map([[path, { variants: { State: state }, prefer: { Interaction: 'Hover' } }]])
      )
      const copy = shown.getChildren(card.id)[0]
      return copy && instanceMainComponent(shown, copy)?.id
    }
    expect(shownWith('Off')).toBe(offHover.id)
    // No hovered On variant: the switch shows On as designed.
    expect(shownWith('On')).toBe(on.id)
  })

  test('a control reveals a layer the design hides, such as a closed panel', () => {
    const { graph, card } = switchCard()
    const hidden = graph.createNode('FRAME', card.id, { name: 'Panel', visible: false })
    const shown = resolvePlayState(graph, card.id, new Map([['Wifi', { reveal: ['Panel'] }]]))
    expect(shown.getNode(hidden.id)?.visible).toBe(true)
    expect(graph.getNode(hidden.id)?.visible).toBe(false)
  })

  test('a replaced document previews from its designed state', () => {
    const editor = createEditor()
    editor.startPlay()
    editor.resetPlay()
    editor.replaceGraph(new SceneGraph())
    expect(editor.state.play).toEqual({ revision: 2 })
  })
})
