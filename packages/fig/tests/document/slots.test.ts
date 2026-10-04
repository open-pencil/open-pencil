import { beforeAll, describe, expect, test } from 'bun:test'

import { readFixtureArrayBuffer } from '#fig-tests/helpers/fig-fixtures'
import { guid } from '#fig-tests/helpers/guid'
import { materializeDocument, materializeFigArchive } from '#fig/document/materialize'
import { DEFAULT_SLOT_CONTENT } from '#fig/instance-overrides/types'

import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/**
 * `slots.fig` was built with Figma's plugin API (`createSlot`, `appendChild`, `resetSlot`,
 * `setProperties`) and saved from Figma. Each instance's expected slot content below is
 * what Figma's `SlotNode.children` reported for that instance before the save.
 */
let graph: SceneGraph

function topLevel(name: string): SceneNode {
  const page = graph.getPages().find((candidate) => candidate.name === 'Slots fixture')
  const node = page && graph.getChildren(page.id).find((child) => child.name === name)
  if (!node) throw new Error(`Missing ${name}`)
  return node
}

function slotFrame(node: SceneNode, from = graph): SceneNode {
  const frame = from
    .getChildren(node.id)
    .find((child) => child.componentPropertyReferences.some((ref) => ref.field === 'SLOT_CONTENT'))
  if (!frame) throw new Error(`No slot frame in ${node.name}`)
  return frame
}

function slotChildren(name: string): string[] {
  return graph.getChildren(slotFrame(topLevel(name)).id).map((child) => child.name)
}

beforeAll(() => {
  graph = materializeFigArchive(readFixtureArrayBuffer('slots.fig')).graph
})

describe('slot properties', () => {
  test('a slot is a SLOT property bound to a frame of its component', () => {
    const card = topLevel('Card empty slot')
    const [definition] = card.componentPropertyDefinitions
    expect(definition).toMatchObject({ name: 'Content', type: 'SLOT' })
    expect(slotFrame(card).componentPropertyReferences).toEqual([
      { propertyId: definition.id, field: 'SLOT_CONTENT' }
    ])
  })

  test('settings, description and preferred components are kept', () => {
    const [definition] = topLevel('List').componentPropertyDefinitions
    expect(definition).toMatchObject({
      name: 'Items',
      type: 'SLOT',
      description: 'Put list items here',
      preferredValues: ['dd573203ee6ffb4302ba13e151f637f67afdcd94'],
      slotSettings: {
        minChildren: 1,
        maxChildren: 3,
        allowPreferredValuesOnly: true,
        displayEmptyByDefault: true,
        stretchChildOnInsert: true
      }
    })
  })

  test('variants sharing a slot each bind their own definition', () => {
    const panel = topLevel('Panel')
    expect(panel.componentPropertyDefinitions.map(({ name, type }) => [name, type])).toEqual([
      ['Content', 'SLOT'],
      ['Size', 'VARIANT']
    ])
    for (const variant of graph.getChildren(panel.id)) {
      const [definition] = variant.componentPropertyDefinitions
      expect(definition.type).toBe('SLOT')
      expect(slotFrame(variant).componentPropertyReferences[0].propertyId).toBe(definition.id)
    }
  })
})

describe('instance slot content', () => {
  test('an untouched instance shows the component content and assigns nothing', () => {
    expect(slotChildren('A untouched')).toEqual([])
    expect(slotChildren('B untouched')).toEqual(['Default body', 'Default image'])
    expect(slotChildren('B reset')).toEqual(['Default body', 'Default image'])
    expect(topLevel('B untouched').componentPropertyAssignments).toEqual({})
  })

  test('assigned content replaces the default, in its saved order', () => {
    expect(slotChildren('A filled')).toEqual(['Added text', 'Added rectangle'])
    expect(slotChildren('B modified')).toEqual([
      'Inserted first',
      'Default image',
      'Added after default'
    ])
    expect(slotChildren('B cleared')).toEqual([])
  })

  test('the instance owns assigned content, which links to no component layer', () => {
    const instance = topLevel('B modified')
    const [definition] = topLevel('Card default content').componentPropertyDefinitions
    expect(Object.keys(instance.componentPropertyAssignments)).toEqual([definition.id])
    for (const child of graph.getChildren(slotFrame(instance).id))
      expect(child.componentId).toBeNull()
  })

  test('instances in a slot keep their own component', () => {
    const item = topLevel('Item')
    const content = graph.getChildren(slotFrame(topLevel('D violations')).id)
    expect(content.map((child) => child.type)).toEqual([
      'INSTANCE',
      'INSTANCE',
      'INSTANCE',
      'INSTANCE',
      'ROUNDED_RECTANGLE'
    ])
    for (const child of content.slice(0, 4)) expect(child.componentId).toBe(item.id)
  })

  test('content survives a variant switch', () => {
    expect(slotChildren('Panel small filled')).toEqual(['Slot content'])
    expect(slotChildren('Panel switched to large')).toEqual(['Survives variant switch?'])
  })

  test('an instance in a slot can fill its own slot', () => {
    const [inner] = graph.getChildren(slotFrame(topLevel('A nested')).id)
    expect(inner.name).toBe('Card default content')
    expect(graph.getChildren(slotFrame(inner).id).map((child) => child.name)).toEqual([
      'Default body',
      'Default image',
      'Inner added'
    ])
  })

  test('content frames are not layers of the internal canvas', () => {
    const internal = graph.getPages(true).find((page) => page.internalOnly)
    if (!internal) throw new Error('Missing internal canvas')
    expect(graph.getChildren(internal.id)).toEqual([])
  })
})

describe('missing slot content', () => {
  /** A card whose slot holds `Default`, and an instance assigning a content frame that is gone. */
  const records = (): NodeChange[] => {
    const slotValue = (target: GUID) => ({
      value: { slotContentIdValue: { guid: target } },
      dataType: 'SLOT_CONTENT_ID',
      resolvedDataType: 'SLOT_CONTENT_ID'
    })
    return [
      { guid: guid(1), type: 'DOCUMENT' },
      { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
      {
        guid: guid(3),
        type: 'SYMBOL',
        name: 'Card',
        parentIndex: { guid: guid(2), position: 'a' },
        componentPropDefs: [
          { id: guid(10), name: 'Content', type: 'SLOT', varValue: slotValue(DEFAULT_SLOT_CONTENT) }
        ]
      },
      {
        guid: guid(4),
        type: 'FRAME',
        name: 'Content',
        parentIndex: { guid: guid(3), position: 'a' },
        parameterConsumptionMap: {
          entries: [
            {
              variableField: 'SLOT_CONTENT_ID',
              variableData: {
                value: { propRefValue: { defId: guid(10) } },
                dataType: 'PROP_REF',
                resolvedDataType: 'SLOT_CONTENT_ID'
              }
            }
          ]
        }
      },
      {
        guid: guid(5),
        type: 'TEXT',
        name: 'Default',
        parentIndex: { guid: guid(4), position: 'a' },
        textData: { characters: 'Default' }
      },
      {
        guid: guid(6),
        type: 'INSTANCE',
        name: 'Card',
        parentIndex: { guid: guid(2), position: 'b' },
        symbolData: { symbolID: guid(3) },
        componentPropAssignments: [{ defID: guid(10), varValue: slotValue(guid(99)) }]
      }
    ] as NodeChange[]
  }

  test('is fatal in strict reads', () => {
    expect(() => materializeDocument(records())).toThrow('Missing slot content')
  })

  test('is reported, and the slot keeps its component content', () => {
    const reported: unknown[] = []
    const result = materializeDocument(records(), [], {
      onMissingSlotContent: (diagnostic) => reported.push(diagnostic)
    })
    const instance = result.sources.get('1:6')
    const node = instance && result.graph.getNode(instance)
    if (!node) throw new Error('Missing instance')
    const content = result.graph.getChildren(slotFrame(node, result.graph).id)
    expect(content.map((child) => child.name)).toEqual(['Default'])
    // Without the assignment the slot keeps following its component.
    expect(node.componentPropertyAssignments).toEqual({})
    expect(reported).toEqual([{ slotId: '1:4', slotContentId: '1:99' }])
  })
})
