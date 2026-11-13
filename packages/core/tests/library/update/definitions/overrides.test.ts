import { describe, expect, test } from 'bun:test'

import {
  createLibraryRevision,
  materializeLibraryAsset,
  updateLibraryDefinitions
} from '@open-pencil/core/library'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { hasInstanceOverride, recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { getInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

/** A library whose button holds an icon instance, a label and two notes, with two icon components. */
function library() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const icons = Object.fromEntries(
    ['Zap', 'Star'].map((name, index) => {
      const icon = graph.createNode('COMPONENT', page.id, {
        name,
        componentKey: name.toLowerCase(),
        x: 200 + index * 40
      })
      graph.createNode('ELLIPSE', icon.id, { name: 'Glyph', width: 16, height: 16 })
      return [name, icon.id]
    })
  )
  const button = graph.createNode('COMPONENT', page.id, {
    name: 'Button',
    componentKey: 'button',
    width: 80
  })
  graph.createInstance(icons.Zap ?? '', button.id, { name: 'Icon' })
  graph.createNode('TEXT', button.id, { name: 'Label', text: 'Old' })
  for (const text of ['First', 'Second'])
    graph.createNode('TEXT', button.id, { name: 'Note', text })
  return { graph, button: button.id }
}

type Library = ReturnType<typeof library>

const revisionOf = (graph: SceneGraph) =>
  createLibraryRevision({ libraryId: 'design-system', name: 'Design system', graph })

function layer(graph: SceneGraph, parentId: string, name: string, rank = 0): SceneNode {
  const found = graph.getChildren(parentId).filter((node) => node.name === name)[rank]
  if (!found) throw new Error(`Expected ${name} #${rank} in ${parentId}`)
  return found
}

/**
 * A document holding an instance of the library's button, edited by `edit`, updated in place
 * after the library widens the button and makes the changes `revise` makes.
 */
async function updated(
  edit: (graph: SceneGraph, instanceId: string) => void,
  revise: (library: Library) => void = () => undefined
) {
  const source = library()
  const graph = new SceneGraph()
  const first = await revisionOf(source.graph)
  const { componentId } = materializeLibraryAsset(graph, first, 'button')
  materializeLibraryAsset(graph, first, 'star')
  const instance = graph.createInstance(componentId, graph.getPages()[0].id)
  if (!instance) throw new Error('Expected the instance')
  edit(graph, instance.id)
  source.graph.updateNode(source.button, { width: 120 })
  revise(source)
  updateLibraryDefinitions(graph, await revisionOf(source.graph))
  return { graph, instance: instance.id }
}

describe('updating library definitions keeps the overrides of their instances', () => {
  test('keeps an instance’s overrides and takes the rest of the new revision', async () => {
    const { graph, instance } = await updated(
      (graph, id) => {
        const label = layer(graph, id, 'Label')
        graph.updateNode(label.id, { text: 'Hello', opacity: 0.5 })
        recordInstanceOverride(graph, label.id, ['text', 'opacity'])
      },
      ({ graph, button }) => graph.updateNode(layer(graph, button, 'Label').id, { text: 'New' })
    )
    const label = layer(graph, instance, 'Label')
    expect(graph.getNode(instance)?.width).toBe(120)
    expect(label).toMatchObject({ text: 'Hello', opacity: 0.5 })
    expect(hasInstanceOverride(graph, label.id, 'text')).toBe(true)
  })

  test('keeps an override on a layer the library renames', async () => {
    const { graph, instance } = await updated(
      (graph, id) => {
        const label = layer(graph, id, 'Label')
        graph.updateNode(label.id, { text: 'Hello' })
        recordInstanceOverride(graph, label.id, ['text'])
      },
      ({ graph, button }) => graph.updateNode(layer(graph, button, 'Label').id, { name: 'Caption' })
    )
    expect(layer(graph, instance, 'Caption').text).toBe('Hello')
  })

  test('keeps each namesake’s override on its own layer when the library adds another', async () => {
    const { graph, instance } = await updated(
      (graph, id) => {
        const second = layer(graph, id, 'Note', 1)
        graph.updateNode(second.id, { text: 'Edited' })
        recordInstanceOverride(graph, second.id, ['text'])
      },
      ({ graph, button }) => {
        const added = graph.createNode('TEXT', button, { name: 'Note', text: 'Zero' })
        graph.insertChildAt(added.id, button, 2)
      }
    )
    const notes = graph.getChildren(instance).filter((node) => node.name === 'Note')
    expect(notes.map((note) => note.text)).toEqual(['Zero', 'First', 'Edited'])
  })

  test('keeps a nested instance it swapped to another component', async () => {
    const { graph, instance } = await updated((graph, id) => {
      const star = [...graph.getAllNodes()].find((node) => node.name === 'Star')
      graph.swapInstanceComponent(layer(graph, id, 'Icon').id, star?.id ?? '')
    })
    const icon = graph.getChildren(instance).find((node) => node.type === 'INSTANCE')
    expect(graph.getNode(icon?.componentId ?? '')?.name).toBe('Star')
  })

  test('keeps a variable it bound, and the scale it reads it at', async () => {
    let accent = ''
    const { graph, instance } = await updated((graph, id) => {
      const collection = graph.createCollection('Tokens')
      accent = graph.createVariable('accent', 'COLOR', collection.id, {
        r: 0,
        g: 0.5,
        b: 0.4,
        a: 1
      }).id
      const fade = graph.createVariable('fade', 'FLOAT', collection.id, 0.25)
      const label = layer(graph, id, 'Label')
      graph.updateNode(label.id, {
        fills: [{ type: 'SOLID', color: { r: 0, g: 0.5, b: 0.4, a: 1 }, opacity: 1, visible: true }]
      })
      graph.bindVariable(label.id, 'fills/0/color', accent)
      graph.bindVariable(label.id, 'opacity', fade.id)
      // A binding read from a scaled instance resolves at twice its variable's value.
      graph.updateNode(label.id, { variableBindingScales: { opacity: 2 } })
      recordInstanceOverride(graph, label.id, ['fills', 'opacity', 'boundVariables'])
    })
    const label = layer(graph, instance, 'Label')
    const owner = graph.getNode(instance)
    if (!owner) throw new Error('Expected the instance')
    expect(
      getInstanceOverride(
        owner.instanceOverrides,
        instance,
        label.id,
        'boundVariables/fills/0/color'
      )
    ).toBe(accent)
    expect(label.variableBindingScales.opacity).toBe(2)
  })

  test('drops the overrides of a layer the library removes', async () => {
    const { graph, instance } = await updated(
      (graph, id) => {
        const second = layer(graph, id, 'Note', 1)
        graph.updateNode(second.id, { text: 'Edited' })
        recordInstanceOverride(graph, second.id, ['text'])
      },
      ({ graph, button }) => graph.deleteNode(layer(graph, button, 'Note', 1).id)
    )
    expect(graph.getChildren(instance).map((node) => node.name)).toEqual(['Icon', 'Label', 'Note'])
    expect(graph.getNode(instance)?.instanceOverrides.descendants.size).toBe(0)
  })
})
