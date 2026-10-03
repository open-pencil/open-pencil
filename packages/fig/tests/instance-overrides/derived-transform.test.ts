import { expect, test } from 'bun:test'

import { interpretInstance, materializeInstance } from '@open-pencil/fig/instance-overrides'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, getNodeLocalMatrix } from '@open-pencil/scene-graph'

for (const reflected of [false, true]) {
  test(`derived size keeps the original local matrix (reflected=${reflected})`, () => {
    const guid = (localID: number) => ({ sessionID: 1, localID })
    const transform = reflected
      ? { m00: 0, m01: -1, m02: 78, m10: -1, m11: 0, m12: 790 }
      : { m00: 1, m01: 0, m02: 8, m10: 0, m11: 1, m12: 8 }
    const changes: NodeChange[] = [
      { guid: guid(1), type: 'SYMBOL' },
      {
        guid: guid(2),
        type: 'VECTOR',
        parentIndex: { guid: guid(1), position: '!' },
        size: { x: 24, y: 24 },
        transform
      },
      {
        guid: guid(3),
        type: 'INSTANCE',
        symbolData: { symbolID: guid(1) },
        derivedSymbolData: [{ guidPath: { guids: [guid(2)] }, size: { x: 184, y: 36 } }]
      }
    ]
    const graph = new SceneGraph()
    const occurrence = interpretInstance(changes, '1:3', { derivedBounds: true })
    const component = graph.createNode('COMPONENT', graph.getPages()[0].id)
    const materialized = materializeInstance(
      graph,
      graph.getPages()[0].id,
      occurrence,
      new Map([['1:1', component.id]])
    )
    const child = graph.getChildren(materialized.root.id)[0]
    expect([child.width, child.height]).toEqual([184, 36])
    const actual = getNodeLocalMatrix(child)
    const expected = [
      transform.m00,
      transform.m01,
      transform.m02,
      transform.m10,
      transform.m11,
      transform.m12
    ]
    for (const [index, value] of expected.entries()) expect(actual[index]).toBeCloseTo(value, 10)
  })
}
