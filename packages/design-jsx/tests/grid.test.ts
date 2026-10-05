import { describe, expect, test } from 'bun:test'

import { jsxNodeFields, parseJSXAttributes } from '#design-jsx/index'

import { SceneGraph, type GridTrack } from '@open-pencil/scene-graph'

function columns(value: string) {
  const graph = new SceneGraph()
  const attributes = parseJSXAttributes(`grid columns="${value}"`)
  return jsxNodeFields(graph, 'FRAME', attributes, graph.getPages()[0].id).fields
    .gridTemplateColumns
}

const fr = (value: number): GridTrack => ({ sizing: 'FR', value })
const fixed = (value: number): GridTrack => ({ sizing: 'FIXED', value })
const FR = fr(1)
const AUTO: GridTrack = { sizing: 'AUTO', value: 0 }

describe('grid track lists', () => {
  test.each<[string, GridTrack[]]>([
    ['1fr 200px 1fr', [FR, fixed(200), FR]],
    ['repeat(3, 1fr)', [FR, FR, FR]],
    ['repeat(2, 40px 1fr)', [fixed(40), FR, fixed(40), FR]],
    ['minmax(0, 1fr) auto', [FR, AUTO]],
    ['2fr 64', [fr(2), fixed(64)]]
  ])('%p', (value, tracks) => {
    expect(columns(value)).toEqual(tracks)
  })

  test('sizes a track the grid cannot express to its content, not to zero', () => {
    expect(columns('10em 1fr')).toEqual([AUTO, FR])
  })
})
