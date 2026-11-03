import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

function getNodeTool() {
  const tool = ALL_TOOLS.find((item) => item.name === 'get_node')
  if (!tool) throw new Error('Missing get_node tool')
  return tool
}

test('get_node includes component properties and layer references', () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const definition = {
    id: 'label',
    name: 'Label',
    type: 'TEXT' as const,
    defaultValue: 'Hi'
  }
  const component = graph.createNode('COMPONENT', figma.currentPageId, {
    name: 'Note',
    componentPropertyDefinitions: [definition]
  })
  graph.createNode('TEXT', component.id, {
    name: 'Label',
    text: 'Hi',
    componentPropertyReferences: [{ propertyId: definition.id, field: 'TEXT' }]
  })

  const result = getNodeTool().execute(figma, { id: component.id })
  expect(result).toMatchObject({
    componentPropertyDefinitions: [definition],
    children: [
      {
        componentPropertyReferences: [{ propertyId: definition.id, field: 'TEXT' }]
      }
    ]
  })
})
