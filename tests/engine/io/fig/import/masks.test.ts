import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'

describe('Figma mask import', () => {
  test('imports schema mask fields', () => {
    const props = nodeChangeToProps(
      {
        type: 'RECTANGLE',
        mask: true,
        maskType: 'LUMINANCE',
        maskIsOutline: true
      } as NodeChange,
      []
    )

    expect(props.isMask).toBe(true)
    expect(props.maskType).toBe('LUMINANCE')
    expect(props.maskIsOutline).toBe(true)
  })
})
