import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'
import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { canvas, doc, node } from '../helpers'

describe('fig-import: auto-layout alignment', () => {
  test('keeps variable-bound leading padding independent', () => {
    const props = nodeChangeToProps(
      {
        type: 'FRAME',
        stackMode: 'VERTICAL',
        stackVerticalPadding: 8,
        stackHorizontalPadding: 6,
        variableConsumptionMap: {
          entries: [
            {
              variableField: 'STACK_PADDING_TOP',
              variableData: {
                value: { alias: { guid: { sessionID: 2, localID: 1 } } }
              }
            },
            {
              variableField: 'STACK_PADDING_LEFT',
              variableData: {
                value: { alias: { guid: { sessionID: 2, localID: 2 } } }
              }
            }
          ]
        }
      } as NodeChange,
      []
    )
    expect(props.paddingTop).toBe(8)
    expect(props.paddingBottom).toBe(0)
    expect(props.paddingLeft).toBe(6)
    expect(props.paddingRight).toBe(0)
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
