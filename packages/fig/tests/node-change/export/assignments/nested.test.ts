import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#fig-tests/helpers/assert'
import { sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  applyComponentPropertyValue,
  componentPropertyDefinitions
} from '@open-pencil/scene-graph/components'

interface Assignment {
  defID?: unknown
  value?: { textValue?: { characters?: string }; boolValue?: boolean }
}

interface InstanceRecord {
  name?: string
  symbolData?: {
    symbolOverrides?: Array<{
      guidPath?: { guids: unknown[] }
      componentPropAssignments?: Assignment[]
    }>
  }
}

/** A Button with a Label and a Shown icon, held by a Card as Action, and a copy of the Card. */
function cardWithButton() {
  const graph = new SceneGraph()
  const [page] = graph.getPages()
  const button = graph.createNode('COMPONENT', page.id, {
    name: 'Button',
    componentPropertyDefinitions: [
      { id: 'prop:label', name: 'Label', type: 'TEXT', defaultValue: 'Continue' },
      { id: 'prop:shown', name: 'Shown', type: 'BOOLEAN', defaultValue: 'true' }
    ]
  })
  graph.createNode('TEXT', button.id, {
    name: 'Text',
    text: 'Continue',
    componentPropertyReferences: [{ propertyId: 'prop:label', field: 'TEXT' }]
  })
  graph.createNode('FRAME', button.id, {
    name: 'Icon',
    componentPropertyReferences: [{ propertyId: 'prop:shown', field: 'VISIBLE' }]
  })
  const card = graph.createNode('COMPONENT', page.id, { name: 'Card' })
  const action = expectDefined(graph.createInstance(button.id, card.id))
  graph.updateNode(action.id, { name: 'Action', isExposedInstance: true })
  const copy = expectDefined(graph.createInstance(card.id, page.id))
  graph.updateNode(copy.id, { name: 'Copy' })
  const copied = expectDefined(graph.getChildren(copy.id).find((child) => child.name === 'Action'))
  return { graph, copy, copied }
}

function assign(graph: SceneGraph, instance: SceneNode, name: string, value: string) {
  const definition = expectDefined(
    componentPropertyDefinitions(graph, instance).find((item) => item.name === name)
  )
  applyComponentPropertyValue(graph, instance.id, definition, value)
}

/** The property values the copy's record gives the instances it holds, by override path. */
function nestedAssignments(graph: SceneGraph, copy: SceneNode): Assignment[][] {
  const records = sceneNodeToKiwi(
    expectDefined(graph.getNode(copy.id)),
    { sessionID: 1, localID: 1 },
    0,
    { value: 2 },
    graph,
    []
  ) as InstanceRecord[]
  const record = expectDefined(records.find((item) => item.name === 'Copy'))
  return (record.symbolData?.symbolOverrides ?? []).flatMap((override) =>
    override.componentPropAssignments ? [override.componentPropAssignments] : []
  )
}

describe('the values a copy gives an instance it holds', () => {
  test('are written on the override at that instance, as Figma stores them', () => {
    const { graph, copy, copied } = cardWithButton()
    assign(graph, copied, 'Label', 'Save')
    assign(graph, copied, 'Shown', 'false')
    const [assignments, ...others] = nestedAssignments(graph, copy)
    expect(others).toEqual([])
    expect(assignments.map((assignment) => assignment.value)).toEqual([
      { textValue: { characters: 'Save' } },
      { boolValue: false }
    ])
  })

  test('are left out when they are what the instance it copies shows', () => {
    const { graph, copy, copied } = cardWithButton()
    expect(nestedAssignments(graph, copy)).toEqual([])
    // Setting the default again is no change either.
    assign(graph, copied, 'Label', 'Continue')
    expect(nestedAssignments(graph, copy)).toEqual([])
  })
})
