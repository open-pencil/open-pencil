import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { createAPI, registerTestFont, solidFill } from '#core-tests/helpers/figma-api'

import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createComponentPropertyId } from '@open-pencil/scene-graph/components'
import { hasInstanceOverride } from '@open-pencil/scene-graph/instances'
import { getInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'


beforeAll(() => registerTestFont())

// Recorded with the same script in Figma desktop 126.

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const component = figma.createComponent()
  component.resize(100, 100)
  component.appendChild(figma.createRectangle())
  const instance = component.createInstance()
  const [layer] = instance.children as FigmaNodeProxy[]
  return { graph, instance, layer }
}

test('a layer inside an instance refuses the fields it always takes from its component', () => {
  const { layer } = setup()
  const refused = (setter: string, property: string) =>
    `in set_${setter}: This property cannot be overridden in an instance: ${property}`
  expect(() => (layer.x = 5)).toThrow(refused('x', 'relative-transform'))
  expect(() => (layer.y = 5)).toThrow(refused('y', 'relative-transform'))
  expect(() => (layer.rotation = 10)).toThrow(refused('rotation', 'relative-transform'))
  expect(
    () =>
      (layer.relativeTransform = [
        [1, 0, 3],
        [0, 1, 3]
      ])
  ).toThrow(refused('relativeTransform', 'relative-transform'))
  expect(() => (layer.constraints = { horizontal: 'MAX', vertical: 'MIN' })).toThrow(
    refused('constraints', 'vertical-constraint')
  )
  expect(() => (layer.isMask = true)).toThrow(refused('isMask', 'is-mask'))
  expect(() => (layer.maskType = 'LUMINANCE')).toThrow(refused('maskType', 'mask-type'))
  expect(() => (layer.counterAxisAlignContent = 'SPACE_BETWEEN')).toThrow(
    refused('counterAxisAlignContent', 'stack-counter-align-content')
  )
})

test('a vector inside an instance refuses its path and handle mirroring', async () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const component = figma.createComponent()
  component.resize(200, 120)
  const shape = figma.createVector()
  component.appendChild(shape)
  shape.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L 100 0 L 50 80 Z' }]
  const instance = component.createInstance()
  const [copy] = instance.children as FigmaNodeProxy[]
  const message = (property: string) =>
    `This property cannot be overridden in an instance: ${property}`
  const network = {
    vertices: [
      { x: 0, y: 0 },
      { x: 60, y: 0 }
    ],
    segments: [{ start: 0, end: 1 }]
  }
  expect(() => (copy.vectorPaths = [{ windingRule: 'NONE', data: 'M 0 0 L 10 0' }])).toThrow(
    `in set_vectorPaths: ${message('vector-data')}`
  )
  expect(() => (copy.vectorNetwork = network)).toThrow(
    `in set_vectorNetwork: ${message('vector-data')}`
  )
  // Figma rejects the async edit with the bare message.
  await expect(copy.setVectorNetworkAsync(network)).rejects.toThrow(
    new RegExp(`^${message('vector-data')}$`)
  )
  expect(() => (copy.handleMirroring = 'ANGLE')).toThrow(
    `in set_handleMirroring: ${message('handle-mirroring')}`
  )
  // The copy still draws the component's path.
  expect(copy.vectorPaths).toEqual(shape.vectorPaths)
})

test('a layer inside an instance can be locked and restyled, each recorded as an override', () => {
  const { graph, instance, layer } = setup()
  layer.locked = true
  layer.strokeWeight = 4
  expect(hasInstanceOverride(graph, layer.id, 'locked')).toBe(true)
  expect(hasInstanceOverride(graph, layer.id, 'strokeWeight')).toBe(true)
  // The instance itself still moves.
  instance.x = 40
  expect(instance.x).toBe(40)
})

/** A Card component whose Body slot shows a default Note layer, and an instance of it. */
function slotSetup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const page = graph.getPages()[0].id
  const body = createComponentPropertyId()
  const card = graph.createNode('COMPONENT', page, {
    componentPropertyDefinitions: [{ id: body, name: 'Body', type: 'SLOT', defaultValue: '' }]
  })
  const frame = graph.createNode('FRAME', card.id, {
    name: 'Body',
    width: 200,
    height: 100,
    componentPropertyReferences: [{ propertyId: body, field: 'SLOT_CONTENT' }]
  })
  const note = graph.createNode('RECTANGLE', frame.id, { name: 'Note', x: 10, y: 10 })
  const instance = expectDefined(graph.createInstance(card.id, page))
  const slot = expectDefined(figma.getNodeById(graph.getChildren(instance.id)[0].id))
  return { graph, figma, card, note, slot }
}

test('a path rejected for a slot’s vector leaves the slot following its component', () => {
  const { graph, figma, card, slot } = slotSetup()
  const shape = figma.createVector()
  const host = expectDefined(figma.getNodeById(graph.getChildren(card.id)[0].id))
  host.appendChild(shape)
  shape.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L 10 0 L 5 10 Z' }]
  graph.syncInstances(card.id)
  const copy = expectDefined(
    (slot.children as FigmaNodeProxy[]).find((child) => child.type === 'VECTOR')
  )
  const broken = {
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 }
    ],
    segments: [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 0 }
    ],
    regions: [{ windingRule: 'NONZERO' as const, loops: [[0, 1, 2]], fills: [null] }]
  }
  expect(() => (copy.vectorNetwork = broken as never)).toThrow()
  // Unclaimed, the slot's default content still takes the component's next edit.
  shape.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L 20 0 L 10 20 Z' }]
  graph.syncInstances(card.id)
  expect(copy.vectorPaths).toEqual(shape.vectorPaths)
})

test('slot content is the instance’s own and keeps its position and constraints', () => {
  const { figma, slot } = slotSetup()
  const added = figma.createRectangle()
  slot.appendChild(added)
  added.x = 12
  added.constraints = { horizontal: 'MAX', vertical: 'MIN' }
  expect([added.x, added.constraints.horizontal]).toEqual([12, 'MAX'])
})

test('moving default slot content claims the slot, so the component no longer moves it', () => {
  const { graph, card, note, slot } = slotSetup()
  const [copy] = slot.children as FigmaNodeProxy[]
  copy.x = 40
  graph.updateNode(note.id, { x: 90 })
  graph.syncInstances(card.id)
  expect(copy.x).toBe(40)
})

describe('setting fills on an instance descendant', () => {
  test('records an instance override so the change survives resync', () => {
    const api = createAPI()
    const icon = api.createComponent()
    icon.resize(16, 16)

    const instance = icon.createInstance()
    const vector = api.graph.createNode('VECTOR', instance.id, { width: 16, height: 16 })
    api.graph.updateNode(vector.id, { componentId: icon.id })

    const vectorProxy = api.getNodeById(vector.id)
    if (!vectorProxy) throw new Error('vector proxy not found')
    vectorProxy.fills = [solidFill({ r: 0, g: 0, b: 1, a: 1 })]

    const raw = api.graph.getNode(instance.id)
    expect(
      getInstanceOverride(
        raw?.instanceOverrides ?? { self: new Map(), descendants: new Map() },
        instance.id,
        vector.id,
        'fills'
      )
    ).toBe(true)
  })

  test('preserves text edits on an instance descendant during resync', () => {
    const api = createAPI()
    const component = api.createComponent()
    const text = api.createText()
    text.characters = 'Default'
    component.appendChild(text)

    const instance = component.createInstance()
    const instanceText = instance.children[0]
    if (!instanceText) throw new Error('instance text not found')
    instanceText.characters = 'Custom'

    expect(
      getInstanceOverride(
        api.graph.getNode(instance.id)?.instanceOverrides ?? {
          self: new Map(),
          descendants: new Map()
        },
        instance.id,
        instanceText.id,
        'text'
      )
    ).toBe(true)

    text.characters = 'Updated default'
    api.graph.syncInstances(component.id)

    expect(instanceText.characters).toBe('Custom')
  })
  test('does not record an override for a node with no instance ancestor', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.fills = [solidFill({ r: 1, g: 0, b: 0, a: 1 })]

    const raw = api.graph.getNode(frame.id)
    expect(raw?.instanceOverrides.self.size ?? 0).toBe(0)
  })
})
