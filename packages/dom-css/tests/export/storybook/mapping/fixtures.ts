import { parseComponentMappings } from '#dom-css/export/storybook/mapping/schema'

import { SceneGraph } from '@open-pencil/scene-graph'

export const REVISION = 'a'.repeat(64)

export function mappingConfigFixture() {
  return {
    version: 1,
    storybook: { baseUrl: 'https://storybook.example.test/components/' },
    components: [
      {
        key: 'button',
        design: { file: 'components/Button.fig', id: '12:10' },
        implementation: { import: 'components/Button.ts', export: 'Button' },
        story: { id: 'components-button--default' }
      }
    ]
  }
}

export function mappedFixture() {
  const graph = new SceneGraph()
  const page = graph.addPage('Library')
  const set = graph.createNode('COMPONENT_SET', page.id, {
    name: 'Button',
    componentPropertyDefinitions: [
      {
        id: '12:20',
        name: 'Size',
        type: 'VARIANT',
        defaultValue: 'Small',
        variantOptions: ['Small', 'Large']
      }
    ]
  })
  set.source.id = '12:10'
  const small = graph.createNode('COMPONENT', set.id, {
    name: 'Small',
    componentPropertyValues: { Size: 'Small' },
    width: 32,
    height: 16
  })
  small.source.id = '12:11'
  const large = graph.createNode('COMPONENT', set.id, {
    name: 'Large',
    componentPropertyValues: { Size: 'Large' },
    width: 64,
    height: 16
  })
  large.source.id = '12:12'
  const input = mappingConfigFixture()
  const config = parseComponentMappings(
    JSON.stringify({
      ...input,
      components: [
        {
          ...input.components[0],
          props: { '12:20': { prop: 'size', values: { Small: 'sm', Large: 'lg' } } },
          states: [
            {
              key: 'large',
              designId: '12:12',
              storyId: 'components-button--large',
              args: { label: 'Example' }
            }
          ]
        }
      ]
    })
  )
  return { graph, page, set, small, large, config, mapping: config.components[0] }
}
