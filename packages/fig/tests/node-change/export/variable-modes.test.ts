import { expect, test } from 'bun:test'

import type { KiwiNodeChange } from '#fig/node-change/export/context'
import { applyVariableModes, claimedVariableModes } from '#fig/node-change/export/variable-modes'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  setInstanceOverride,
  variableModeOverrideField
} from '@open-pencil/scene-graph/instances/overrides'

const SIZES = '1:3'
const COMPACT = '1:10'
const WIDE = '1:11'
const sizes = { variableSetID: { guid: { sessionID: 1, localID: 3 } } }
const modeOf = (localID: number) => ({ ...sizes, variableModeID: { sessionID: 1, localID } })

function cardWithNestedLeaf() {
  const graph = new SceneGraph()
  graph.addCollection({
    id: SIZES,
    name: 'Sizes',
    modes: [
      { modeId: COMPACT, name: 'Compact' },
      { modeId: WIDE, name: 'Wide' }
    ],
    defaultModeId: COMPACT,
    variableIds: []
  })
  const page = graph.getPages()[0]
  const leaf = graph.createNode('COMPONENT', page.id, {
    name: 'Leaf',
    variableModes: { [SIZES]: WIDE }
  })
  const card = graph.createNode('COMPONENT', page.id, { name: 'Card' })
  const placed = graph.createInstance(leaf.id, card.id)
  if (!placed) {
    throw new Error('Missing nested instance')
  }
  graph.updateNode(placed.id, { variableModes: { [SIZES]: COMPACT } })
  const outer = graph.createInstance(card.id, page.id)
  const nested = outer ? graph.getChildren(outer.id)[0] : undefined
  if (!outer || !nested) {
    throw new Error('Missing outer instance')
  }
  return { graph, outer, nested }
}

function claimWith(variableModes: Record<string, string>, recorded = false) {
  const { graph, outer, nested } = cardWithNestedLeaf()
  graph.updateNode(nested.id, { variableModes })
  if (recorded) {
    const field = variableModeOverrideField(SIZES)
    setInstanceOverride(outer.instanceOverrides, outer.id, nested.id, field)
  }
  const layer: SceneNode | undefined = graph.getNode(nested.id)
  if (!layer) {
    throw new Error('Missing nested layer')
  }
  return claimedVariableModes({ graph }, outer, outer, layer).entries
}

test('a mode the nested layer of the outer component sets is not claimed again', () => {
  expect(claimWith({ [SIZES]: COMPACT })).toEqual([])
})

test('a mode that differs from the nested layer is claimed, even when the main sets it', () => {
  expect(claimWith({ [SIZES]: WIDE })).toEqual([modeOf(11)])
})

test('a mode the nested layer no longer has is claimed without a mode', () => {
  expect(claimWith({})).toEqual([sizes])
})

test('a collection the file claimed stays explicit when it matches the nested layer', () => {
  expect(claimWith({ [SIZES]: COMPACT }, true)).toEqual([modeOf(10)])
})

test('an instance record follows its component unless it sets its own modes', () => {
  const { graph, outer } = cardWithNestedLeaf()
  const followed: KiwiNodeChange = {}
  applyVariableModes({ graph }, outer, followed)
  setInstanceOverride(outer.instanceOverrides, outer.id, outer.id, 'variableModes')
  const own: KiwiNodeChange = {}
  applyVariableModes({ graph }, outer, own)

  expect(followed.variableModeBySetMap).toBeUndefined()
  expect(own.variableModeBySetMap).toEqual({ entries: [] })
})
