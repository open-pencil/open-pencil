import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'
import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { canvas, doc, node } from '../helpers'

describe('fig-import: auto-layout alignment', () => {
  test('keeps leading padding independent when trailing fields are omitted', () => {
    const props = nodeChangeToProps(
      {
        type: 'FRAME',
        stackMode: 'VERTICAL',
        stackVerticalPadding: 8,
        stackHorizontalPadding: 6
      } as NodeChange,
      []
    )
    expect(props.paddingTop).toBe(8)
    expect(props.paddingBottom).toBe(0)
    expect(props.paddingLeft).toBe(6)
    expect(props.paddingRight).toBe(0)
  })

  test('imports min and max size vectors as axis constraints', () => {
    const props = nodeChangeToProps(
      {
        type: 'FRAME',
        minSize: { value: { x: 192, y: 0 } },
        maxSize: { value: { x: 672, y: -1 } }
      } as NodeChange,
      []
    )

    expect(props.minWidth).toBe(192)
    expect(props.minHeight).toBeNull()
    expect(props.maxWidth).toBe(672)
    expect(props.maxHeight).toBeNull()
  })

  test('maps SPACE_EVENLY kiwi primary alignment to Figma space-between', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, {
        stackMode: 'HORIZONTAL',
        stackPrimaryAlignItems: 'SPACE_EVENLY'
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.primaryAxisAlign).toBe('SPACE_BETWEEN')
  })
})
