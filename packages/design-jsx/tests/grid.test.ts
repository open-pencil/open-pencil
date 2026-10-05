import { describe, expect, test } from 'bun:test'

import { jsxNodeFields, parseJSXAttributes } from '#design-jsx/index'

import { SceneGraph } from '@open-pencil/scene-graph'

function columns(value: string) {
  const graph = new SceneGraph()
  const attributes = parseJSXAttributes(`grid columns="${value}"`)
  return jsxNodeFields(graph, 'FRAME', attributes, graph.getPages()[0].id).fields
    .gridTemplateColumns
}

const FR = { sizing: 'FR', value: 1 }

describe('grid track lists', () => {
  test.each([
    ['1fr 200px 1fr', [FR, { sizing: 'FIXED', value: 200 }, FR]],
    ['repeat(3, 1fr)', [FR, FR, FR]],
    [
      'repeat(2, 40px 1fr)',
      [{ sizing: 'FIXED', value: 40 }, FR, { sizing: 'FIXED', value: 40 }, FR]
    ],
    ['minmax(0, 1fr) auto', [FR, { sizing: 'AUTO', value: 0 }]],
    [
      '2fr 64',
      [
        { sizing: 'FR', value: 2 },
        { sizing: 'FIXED', value: 64 }
      ]
    ]
  ])('%p', (value, tracks) => {
    expect(columns(value)).toEqual(tracks)
  })

  test('sizes a track the grid cannot express to its content, not to zero', () => {
    expect(columns('10em 1fr')).toEqual([{ sizing: 'AUTO', value: 0 }, FR])
  })
})
