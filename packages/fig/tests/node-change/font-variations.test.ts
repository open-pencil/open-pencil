import { expect, test } from 'bun:test'

import { nodeChangeToProps, sceneNodeToKiwi } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

const OPSZ = 0x6f70737a

test('reads an optical size Figma detached from the font size, and follows it otherwise', () => {
  const detached = nodeChangeToProps(
    {
      type: 'TEXT',
      fontVariations: [{ axisTag: OPSZ, axisName: 'opsz', value: 8 }],
      detachOpticalSizeFromFontSize: true
    } as NodeChange,
    []
  )
  expect(detached.opticalSizeFromFontSize).toBe(false)
  expect(detached.fontVariations).toEqual([{ axis: 'opsz', value: 8 }])
  expect(nodeChangeToProps({ type: 'TEXT' } as NodeChange, []).opticalSizeFromFontSize).toBe(true)
})

test('writes the detached optical size only when the text has one', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const write = (opticalSizeFromFontSize: boolean) => {
    const node = graph.createNode('TEXT', page, { text: 'Faces', opticalSizeFromFontSize })
    return sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])[0]
  }
  expect(write(false).detachOpticalSizeFromFontSize).toBe(true)
  expect(write(true).detachOpticalSizeFromFontSize).toBeUndefined()
})
