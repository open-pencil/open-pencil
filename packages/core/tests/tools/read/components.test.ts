import { expect, test } from 'bun:test'

import { FigmaAPI } from '@lawha/core/figma-api'
import { ALL_TOOLS } from '@lawha/core/tools'
import { SceneGraph } from '@lawha/scene-graph'

function getComponentsTool() {
  const tool = ALL_TOOLS.find((item) => item.name === 'get_components')
  if (!tool) throw new Error('Missing get_components tool')
  return tool
}

test('get_components includes component property definitions', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  const component = figma.createComponent()
  component.name = 'Note'
  component.addComponentProperty('Label', 'TEXT', 'Hi')

  const result = await getComponentsTool().execute(figma, { source: 'document' })
  expect(result).toMatchObject({
    components: [
      {
        id: component.id,
        name: 'Note',
        componentPropertyDefinitions: [
          expect.objectContaining({ name: 'Label', type: 'TEXT', defaultValue: 'Hi' })
        ]
      }
    ]
  })
})
