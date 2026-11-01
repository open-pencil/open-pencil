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

test('reads and writes an optical size detached for a range, as Figma saves one', () => {
  // As Figma saved "Auto Fixed" with automatic optical size turned off for "Fixed" alone.
  const props = nodeChangeToProps(
    {
      type: 'TEXT',
      textData: {
        characters: 'Auto Fixed',
        characterStyleIDs: [0, 0, 0, 0, 0, 3, 3, 3, 3, 3],
        styleOverrideTable: [
          {
            styleID: 3,
            detachOpticalSizeFromFontSize: true,
            fontVariations: [{ axisTag: OPSZ, axisName: 'OPTICAL SIZE', value: 40 }]
          }
        ]
      }
    } as NodeChange,
    []
  )
  expect(props.opticalSizeFromFontSize).toBe(true)
  expect(props.styleRuns).toEqual([
    {
      start: 5,
      length: 5,
      style: { opticalSizeFromFontSize: false, fontVariations: [{ axis: 'opsz', value: 40 }] }
    }
  ])

  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Auto Fixed',
    styleRuns: props.styleRuns
  })
  const [written] = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
  expect(written.detachOpticalSizeFromFontSize).toBeUndefined()
  expect(written.textData?.styleOverrideTable?.[0]?.detachOpticalSizeFromFontSize).toBe(true)
})
