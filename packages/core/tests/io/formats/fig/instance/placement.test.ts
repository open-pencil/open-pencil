import { expect, test } from 'bun:test'

import { computeAllLayouts } from '@open-pencil/core/layout'
import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { guid } from '@open-pencil/test-support/fig/guid'

function at(x: number, y: number) {
  return { m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y }
}

function child(parent: number, position: string) {
  return { parentIndex: { guid: guid(parent), position } }
}

const CARD_ID = '1:3'
const PANEL_INSTANCE_ID = '1:8'

function nestedBarRecords(): NodeChange[] {
  return [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', ...child(0, '!') },
    {
      guid: guid(2),
      type: 'SYMBOL',
      ...child(1, '!'),
      size: { x: 86, y: 24 },
      transform: at(0, 0),
      stackChildAlignSelf: 'STRETCH',
      stackChildPrimaryGrow: 1,
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'MAX'
    },
    {
      guid: guid(3),
      type: 'SYMBOL',
      ...child(1, '"'),
      size: { x: 120, y: 96 },
      transform: at(200, 0),
      stackMode: 'VERTICAL',
      stackPrimarySizing: 'FIXED',
      stackCounterAlignItems: 'CENTER'
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      ...child(3, '!'),
      size: { x: 86, y: 24 },
      transform: at(17, 0),
      symbolData: { symbolID: guid(2) }
    },
    {
      guid: guid(5),
      type: 'SYMBOL',
      ...child(1, '#'),
      size: { x: 120, y: 96 },
      transform: at(400, 0)
    },
    {
      guid: guid(7),
      type: 'INSTANCE',
      ...child(5, '!'),
      size: { x: 120, y: 96 },
      transform: at(0, 0),
      symbolData: { symbolID: guid(3) }
    },
    {
      guid: guid(8),
      type: 'INSTANCE',
      ...child(1, '$'),
      size: { x: 120, y: 96 },
      transform: at(600, 0),
      symbolData: { symbolID: guid(5) }
    }
  ] as NodeChange[]
}

function onlyChild(graph: SceneGraph, parent: SceneNode): SceneNode {
  const [first] = graph.getChildren(parent.id)
  return expectDefined(first)
}

test('a card copied into another instance centres the bar as Figma saved it', () => {
  const { graph, sources } = materializeDocument(nestedBarRecords())
  computeAllLayouts(graph)
  const panel = expectDefined(graph.getNode(expectDefined(sources.get(PANEL_INSTANCE_ID))))
  const card = onlyChild(graph, panel)
  const bar = onlyChild(graph, card)

  expect(card.componentId).toBe(expectDefined(sources.get(CARD_ID)))
  expect(bar).toMatchObject({ x: 17, y: 0, width: 86, height: 24 })
})
