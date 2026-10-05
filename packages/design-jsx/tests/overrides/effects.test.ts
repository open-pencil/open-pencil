import { describe, expect, test } from 'bun:test'

import { jsxNodeFields, parseJSXAttributes } from '#design-jsx/index'

import { SceneGraph } from '@open-pencil/scene-graph'

function effects(attributes: string) {
  const graph = new SceneGraph()
  return jsxNodeFields(graph, 'FRAME', parseJSXAttributes(attributes), graph.getPages()[0].id)
    .fields.effects
}

const RED = { r: 1, g: 0, b: 0, a: 1 }

describe('the shadow prop', () => {
  test.each([
    ['the color last', 'shadow="0 4 8 #ff0000"'],
    ['the color first', 'shadow="rgb(255 0 0) 0 4px 8px"']
  ])('reads a shadow with %s', (_case, attributes) => {
    expect(effects(attributes)).toEqual([
      {
        type: 'DROP_SHADOW',
        color: RED,
        offset: { x: 0, y: 4 },
        radius: 8,
        spread: 0,
        visible: true
      }
    ])
  })

  test('reads spread and every layer of a shadow list', () => {
    expect(effects('shadow="0 4 8 2 #ff0000, inset 0 1 0 #000"')).toMatchObject([
      { type: 'DROP_SHADOW', spread: 2, color: RED },
      { type: 'INNER_SHADOW', offset: { x: 0, y: 1 } }
    ])
  })
})
