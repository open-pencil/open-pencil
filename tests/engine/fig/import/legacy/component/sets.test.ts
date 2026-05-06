import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from '../helpers'

describe('fig-import: component set detection', () => {
  test('FRAME with VARIANT componentPropDefs becomes COMPONENT_SET', () => {
    const changes: NodeChange[] = [
      doc(),
      canvas(),
      {
        ...node('FRAME', 10, 1),
        name: 'Button',
        componentPropDefs: [{ id: { sessionID: 0, localID: 1 }, name: 'State', type: 'VARIANT' }]
      } as NodeChange,
      {
        ...node('SYMBOL', 11, 1),
        parentIndex: { guid: { sessionID: 1, localID: 10 }, position: '!' },
        name: 'State=Default'
      } as NodeChange,
      {
        ...node('SYMBOL', 12, 1),
        parentIndex: { guid: { sessionID: 1, localID: 10 }, position: '"' },
        name: 'State=Hover'
      } as NodeChange
    ]
    const graph = importNodeChanges(changes, [])
    const page = graph.getPages()[0]
    const set = graph.getChildren(page.id)[0]
    expect(set.type).toBe('COMPONENT_SET')
    expect(set.name).toBe('Button')
    const children = graph.getChildren(set.id)
    expect(children).toHaveLength(2)
    expect(children[0].type).toBe('COMPONENT')
    expect(children[1].type).toBe('COMPONENT')
  })

  test('FRAME without componentPropDefs stays FRAME', () => {
    const changes: NodeChange[] = [doc(), canvas(), node('FRAME', 10, 1, { name: 'Regular Frame' })]
    const graph = importNodeChanges(changes, [])
    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    expect(frame.type).toBe('FRAME')
  })
})
