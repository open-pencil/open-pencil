import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '#core/kiwi/fig/codec'
import { nodeChangeToProps, importStyleRuns } from '#core/kiwi/fig/node-change/convert'

describe('Figma font variation import', () => {
  test('imports base text variable font axes', () => {
    const props = nodeChangeToProps(
      {
        type: 'TEXT',
        textData: { characters: 'Axis' },
        fontVariations: [
          { axisTag: 0x77676874, value: 650 },
          { axisName: 'wdth', value: 88 }
        ]
      } as NodeChange,
      []
    )

    expect(props.fontVariations).toEqual([
      { axis: 'wght', value: 650 },
      { axis: 'wdth', value: 88 }
    ])
  })

  test('imports styled-run variable font axes', () => {
    const runs = importStyleRuns({
      type: 'TEXT',
      fontSize: 16,
      textData: {
        characters: 'Axis',
        characterStyleIDs: [1, 1, 0, 0],
        styleOverrideTable: [
          {
            styleID: 1,
            fontVariations: [{ axisName: 'GRAD', value: -50 }]
          } as NodeChange
        ]
      }
    } as NodeChange)

    expect(runs).toEqual([
      { start: 0, length: 2, style: { fontVariations: [{ axis: 'GRAD', value: -50 }] } }
    ])
  })
})
