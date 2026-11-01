import { describe, expect, test } from 'bun:test'

import { createEditor, playIslandRoots, resolvePlayState } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'
import { emptyBehaviour, findLayerByPath, layerPath } from '@open-pencil/scene-graph/behaviours'
import { instanceMainComponent } from '@open-pencil/scene-graph/instances'

/** A Switch set (State × Interaction) and a card frame holding an Off instance with a label. */
function switchCard() {
  const editor = createEditor()
  const graph = editor.graph
  const pageId = editor.state.currentPageId
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Switch',
    componentPropertyDefinitions: [
      {
        id: 'state',
        name: 'State',
        type: 'VARIANT',
        defaultValue: 'Off',
        variantOptions: ['Off', 'On']
      },
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

  test('an instance named after its variant keeps its path through a state switch', () => {
    const { graph, card, off, on } = switchCard()
    // Left with its default name, which is its variant's, as instances placed from a set are.
    const instance = graph.createInstance(off.id, card.id)
    if (!instance) throw new Error('No instance')
    const path = layerPath(graph, card.id, instance.id)
    expect(instance.name).toBe(off.name)

    const shown = resolvePlayState(graph, card.id, new Map([[path, { variants: { State: 'On' } }]]))
    const copy = findLayerByPath(shown, card.id, path)
    expect(copy && instanceMainComponent(shown, copy)?.id).toBe(on.id)
    expect(copy?.name).toBe(off.name)
    // The same path switches it back, so a control toggles both ways.
    const back = resolvePlayState(graph, card.id, new Map([[path, { variants: { State: 'Off' } }]]))
    const restored = findLayerByPath(back, card.id, path)
    expect(restored && instanceMainComponent(back, restored)?.id).toBe(off.id)
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
    expect(editor.state.canvasView).toEqual({ id: 'play', revision: 2 })
  })

  test('a copy paints bound colors in the mode the canvas is showing, not as they were saved', () => {
    const { graph, card } = switchCard()
    const collection = graph.createCollection('Theme')
    const dark = collection.defaultModeId
    graph.addMode(collection.id, 'light', 'Light', dark)
    const surface = graph.createVariable('Surface', 'COLOR', collection.id, {
      r: 0.1,
      g: 0.1,
      b: 0.1,
      a: 1
    })
    surface.valuesByMode.light = { r: 1, g: 1, b: 1, a: 1 }
    graph.updateNode(card.id, {
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.bindVariable(card.id, 'fills/0/color', surface.id)
    graph.setActiveMode(collection.id, 'light')

    const shown = resolvePlayState(graph, card.id, new Map())

    expect(shown.getNode(card.id)?.fills[0]?.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    expect(graph.getNode(card.id)?.fills[0]?.color).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 1 })
  })
})
