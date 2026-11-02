import { expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph } from '@lawha/scene-graph'

/** The fields a record's parameter map binds, in order. */
function parameterFields(record: { parameterConsumptionMap?: unknown }): string[] {
  const map = record.parameterConsumptionMap as
    | { entries?: Array<{ variableField?: string }> }
    | undefined
  return (map?.entries ?? []).map((entry) => entry.variableField ?? '')
}

test('a slot frame with a bound corner radius keeps its slot reference in the parameter map', () => {
  const graph = new SceneGraph()
  const [page] = graph.getPages()
  graph.addCollection({
    id: 'collection',
    name: 'Theme',
    modes: [{ modeId: 'mode', name: 'Mode' }],
    defaultModeId: 'mode',
    variableIds: []
  })
  graph.addVariable({
    id: 'radius',
    name: 'Radius',
    type: 'FLOAT',
    collectionId: 'collection',
    valuesByMode: { mode: 12 },
    description: '',
    hiddenFromPublishing: false
  })
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'Card',
    componentPropertyDefinitions: [
      { id: 'prop:slot', name: 'Content', type: 'SLOT', defaultValue: '' }
    ]
  })
  graph.createNode('FRAME', component.id, {
    name: 'Content',
    cornerRadius: 12,
    boundVariables: { cornerRadius: 'radius' },
    componentPropertyReferences: [{ propertyId: 'prop:slot', field: 'SLOT_CONTENT' }]
  })

  const records = sceneNodeToKiwi(
    component,
    { sessionID: 1, localID: 1 },
    0,
    { value: 2 },
    graph,
    []
  )
  const frame = records.find((record) => record.name === 'Content')
  expect(frame).toBeDefined()
  expect(parameterFields(frame ?? {}).sort()).toEqual(['CORNER_RADIUS', 'SLOT_CONTENT_ID'])
})
