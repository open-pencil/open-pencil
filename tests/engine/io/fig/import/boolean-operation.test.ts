import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '#core/kiwi/fig/codec'
import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'

describe('Figma boolean operation import', () => {
  test('preserves boolean operation nodes', () => {
    const props = nodeChangeToProps(
      {
        type: 'BOOLEAN_OPERATION',
        name: 'Imported boolean',
        booleanOperation: 'SUBTRACT'
      } as NodeChange,
      []
    )

    expect(props.nodeType).toBe('BOOLEAN_OPERATION')
    expect(props.booleanOperation).toBe('SUBTRACT')
  })

  test('defaults missing boolean operations to union', () => {
    const props = nodeChangeToProps(
      {
        type: 'BOOLEAN_OPERATION',
        name: 'Imported boolean'
      } as NodeChange,
      []
    )

    expect(props.nodeType).toBe('BOOLEAN_OPERATION')
    expect(props.booleanOperation).toBe('UNION')
  })
})
