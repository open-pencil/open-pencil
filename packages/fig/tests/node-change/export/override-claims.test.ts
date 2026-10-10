import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#fig-tests/helpers/assert'
import { symbolDataOf } from '#fig/instance-overrides/types'
import type { KiwiNodeChange, KiwiSymbolOverridePayload } from '#fig/node-change/export/context'
import { mergeOverrides } from '#fig/node-change/export/override-claims'
import { sceneNodeToKiwi } from '#fig/node-change/index'

import {
  claimSlotContent,
  recordInstanceOverride,
  SceneGraph,
  slotScope
} from '@open-pencil/scene-graph'

const at = (...ids: number[]) => ({ guids: ids.map((localID) => ({ sessionID: 1, localID })) })

describe('merging symbol overrides', () => {
  test('an override at a path already claimed merges into the last claim at that path', () => {
    const overrides: KiwiSymbolOverridePayload[] = [
      { guidPath: at(1), name: 'first' },
      { guidPath: at(2), visible: false },
      { guidPath: at(1), opacity: 0.5 }
    ]

    mergeOverrides(overrides, [{ guidPath: at(1), name: 'renamed' }])

    expect(overrides).toEqual([
      { guidPath: at(1), name: 'first' },
      { guidPath: at(2), visible: false },
      { guidPath: at(1), opacity: 0.5, name: 'renamed' }
    ])
  })

  test('new paths are added, and two new overrides at one path become one', () => {
    const overrides: KiwiSymbolOverridePayload[] = [{ guidPath: at(1), name: 'kept' }]

    mergeOverrides(overrides, [
      { guidPath: at(3, 4), visible: false },
      { guidPath: at(3, 4), opacity: 0.25 },
      { name: 'no path' },
      { name: 'no path either' }
    ])

    expect(overrides).toEqual([
      { guidPath: at(1), name: 'kept' },
      { guidPath: at(3, 4), visible: false, opacity: 0.25 },
      { name: 'no path' },
      { name: 'no path either' }
    ])
  })
})

describe('claims around slot content', () => {
  test('an instance in slot content its owner claimed writes its own overrides', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const badge = graph.createNode('COMPONENT', page.id, { name: 'Badge' })
    graph.createNode('ELLIPSE', badge.id, { name: 'Dot' })
    const card = graph.createNode('COMPONENT', page.id, {
      name: 'Card',
      componentPropertyDefinitions: [
        { id: 'slot', name: 'Content', type: 'SLOT', defaultValue: '' }
      ]
    })
    const slot = graph.createNode('FRAME', card.id, {
      name: 'Content',
      componentPropertyReferences: [{ propertyId: 'slot', field: 'SLOT_CONTENT' }]
    })
    expectDefined(graph.createInstance(badge.id, slot.id), 'nested badge')
    const instance = expectDefined(graph.createInstance(card.id, page.id), 'card')
    const slotCopy = expectDefined(graph.getChildren(instance.id)[0], 'slot copy')
    const scope = slotScope(graph, slotCopy.id)
    if (scope.kind !== 'slot') throw new Error('Expected a slot')
    claimSlotContent(graph, scope)
    const badgeCopy = expectDefined(graph.getChildren(slotCopy.id)[0], 'badge copy')
    const dotCopy = expectDefined(graph.getChildren(badgeCopy.id)[0], 'dot copy')
    graph.updateNode(dotCopy.id, { opacity: 0.5 })
    recordInstanceOverride(graph, dotCopy.id, ['opacity'])

    const slotContentRecords: KiwiNodeChange[] = []
    const [change] = sceneNodeToKiwi(
      expectDefined(graph.getNode(instance.id), 'card'),
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      [],
      { nodeIdToGuid: new Map(), assignedGuidValues: new Set(), slotContentRecords }
    )

    const claims = (records: KiwiNodeChange[]) =>
      records.flatMap((record) => symbolDataOf(record)?.symbolOverrides ?? [])
    const placed = slotContentRecords.filter((record) => record.type === 'INSTANCE')
    expect(claims([change])).toEqual([])
    expect(placed).toHaveLength(1)
    expect(claims(placed)).toMatchObject([{ opacity: 0.5 }])
  })
})
