import { expect, test } from 'bun:test'

import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { guid } from '@open-pencil/test-support/fig/guid'

const CARD_ID = '1:3'

function childOf(parent: number, position: string) {
  return { parentIndex: { guid: guid(parent), position } }
}

function cardWithBar(
  barPlacement: Partial<NodeChange>,
  instancePlacement: Partial<NodeChange>
): NodeChange[] {
  return [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', ...childOf(0, '!') },
    { guid: guid(2), type: 'SYMBOL', ...childOf(1, '!'), size: { x: 86, y: 24 }, ...barPlacement },
    {
      guid: guid(3),
      type: 'SYMBOL',
      ...childOf(1, '"'),
      size: { x: 120, y: 96 },
      stackMode: 'VERTICAL',
      stackPrimarySizing: 'FIXED',
      stackCounterAlignItems: 'CENTER'
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      ...childOf(3, '!'),
      size: { x: 86, y: 24 },
      symbolData: { symbolID: guid(2) },
      ...instancePlacement
    }
  ] as NodeChange[]
}

function barInCard(
  barPlacement: Partial<NodeChange>,
  instancePlacement: Partial<NodeChange> = {}
): SceneNode {
  const { graph, sources } = materializeDocument(cardWithBar(barPlacement, instancePlacement))
  const card = expectDefined(graph.getNode(expectDefined(sources.get(CARD_ID))))
  return onlyChild(graph, card)
}

function onlyChild(graph: SceneGraph, parent: SceneNode): SceneNode {
  const [first] = graph.getChildren(parent.id)
  return expectDefined(first)
}

test('an instance that omits how it sits in its parent takes the defaults, not its component’s', () => {
  const bar = barInCard({
    stackChildAlignSelf: 'STRETCH',
    stackChildPrimaryGrow: 1,
    horizontalConstraint: 'SCALE',
    verticalConstraint: 'MAX'
  })

  expect(bar).toMatchObject({
    layoutAlignSelf: 'AUTO',
    layoutGrow: 0,
    horizontalConstraint: 'MIN',
    verticalConstraint: 'MIN'
  })
})

test('an instance of a component placed absolutely in its own parent stays in flow', () => {
  const bar = barInCard({ stackPositioning: 'ABSOLUTE' })

  expect(bar.layoutPositioning).toBe('AUTO')
})

const STRETCHED_PLACEMENT = {
  stackChildAlignSelf: 'STRETCH',
  stackChildPrimaryGrow: 1,
  horizontalConstraint: 'SCALE',
  verticalConstraint: 'MAX'
} satisfies Partial<NodeChange>

test.each([
  ['the same as its component’s', STRETCHED_PLACEMENT],
  ['where its component has none', {}]
])('an instance keeps the placement its own record writes, %s', (_, barPlacement) => {
  const bar = barInCard(barPlacement, { ...STRETCHED_PLACEMENT, stackPositioning: 'ABSOLUTE' })

  expect(bar).toMatchObject({
    layoutAlignSelf: 'STRETCH',
    layoutGrow: 1,
    horizontalConstraint: 'SCALE',
    verticalConstraint: 'MAX',
    layoutPositioning: 'ABSOLUTE'
  })
})
