import { expect, test } from 'bun:test'

import { materializeComponentClosure } from '#fig/instance-overrides/component-closure'
import { interpretInstance } from '#fig/instance-overrides/interpret'
import {
  bindSourceProperties,
  componentBindings,
  instanceBindings,
  type BoundPropertyClaim
} from '#fig/instance-overrides/interpret-bindings'
import { materializeInstance } from '#fig/instance-overrides/materialize-instance'
import { mapInstanceSourceChildren } from '#fig/instance-overrides/source-children'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, hasInstanceOverride } from '@open-pencil/scene-graph'

test('materialization preserves explicit equal-to-default text', () => {
  const guid = (localID: number) => ({ sessionID: 3, localID })
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'TEXT',
      parentIndex: { guid: guid(1), position: '!' },
      textData: { characters: 'Default' }
    },
    {
      guid: guid(3),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [{ guidPath: { guids: [guid(2)] }, textData: { characters: 'Default' } }]
      }
    } as NodeChange
  ]
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const occurrence = interpretInstance(changes, '3:3')
  const closure = materializeComponentClosure(graph, page.id, changes, occurrence)
  const ids = new Map([...closure].map(([id, value]) => [id, value.materialized.root.id]))
  const result = materializeInstance(
    graph,
    page.id,
    occurrence,
    ids,
    [],
    mapInstanceSourceChildren(occurrence, closure)
  )
  const component = closure.get('3:1')
  if (!component) throw new Error('Missing component')
  graph.updateNode(graph.getChildren(component.materialized.root.id)[0].id, { text: 'Changed' })
  graph.syncInstances(component.materialized.root.id)
  expect(graph.getChildren(result.root.id)[0].text).toBe('Default')
})

const id = { sessionID: 1, localID: 10 }

for (const assigned of [false, true]) {
  test(`materialization protects Boolean assignments only (assigned=${assigned})`, () => {
    const guid = (localID: number) => ({ sessionID: 2, localID })
    const changes = [
      {
        guid: guid(1),
        type: 'SYMBOL',
        componentPropDefs: [{ id, initialValue: { boolValue: false } }]
      },
      {
        guid: guid(2),
        type: 'RECTANGLE',
        parentIndex: { guid: guid(1), position: '!' },
        componentPropRefs: [{ defID: id, componentPropNodeField: 'VISIBLE' }]
      },
      {
        guid: guid(3),
        type: 'INSTANCE',
        symbolData: { symbolID: guid(1) },
        componentPropAssignments: assigned ? [{ defID: id, value: { boolValue: false } }] : []
      }
    ] as NodeChange[]
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const occurrence = interpretInstance(changes, '2:3')
    const closure = materializeComponentClosure(graph, page.id, changes, occurrence)
    const ids = new Map([...closure].map(([id, value]) => [id, value.materialized.root.id]))
    const result = materializeInstance(
      graph,
      page.id,
      occurrence,
      ids,
      [],
      mapInstanceSourceChildren(occurrence, closure)
    )
    const child = graph.getChildren(result.root.id)[0]
    expect(child.visible).toBe(false)
    expect(hasInstanceOverride(graph, child.id, 'visible')).toBe(assigned)
  })
}

test('distinguishes an equal-to-default Boolean assignment from a component default', () => {
  const component = {
    componentPropDefs: [{ id, initialValue: { boolValue: false } }]
  } as NodeChange
  const child = {
    componentPropRefs: [{ defID: id, componentPropNodeField: 'VISIBLE' }]
  } as NodeChange
  const defaults = componentBindings(component)
  const inheritedClaims: BoundPropertyClaim[] = []
  const assignedClaims: BoundPropertyClaim[] = []
  const inherited = bindSourceProperties(child, defaults, (claim) => inheritedClaims.push(claim))
  const assigned = bindSourceProperties(
    child,
    instanceBindings(defaults, [{ defID: id, value: { boolValue: false } }]),
    (claim) => assignedClaims.push(claim)
  )
  expect(inherited.visible).toBe(false)
  expect(assigned.visible).toBe(false)
  expect(inheritedClaims).toEqual([{ definitionId: id, field: 'visible', origin: 'default' }])
  expect(assignedClaims).toEqual([{ definitionId: id, field: 'visible', origin: 'assignment' }])
})
