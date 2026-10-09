import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#fig-tests/helpers/assert'
import { symbolDataOf } from '#fig/instance-overrides/types'
import type { KiwiNodeChange, KiwiSymbolOverridePayload } from '#fig/node-change/export/context'
import { mergeOverrides } from '#fig/node-change/export/override-claims'
import { sceneNodeToKiwi } from '#fig/node-change/index'

import { UNSET_GUID } from '@open-pencil/kiwi/fig/guid'
import {
  claimSlotContent,
  recordInstanceOverride,
  SceneGraph,
  setLayerOverride,
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

const CLAIMED = {
  strokeWeight: 4,
  cornerRadius: 8,
  dashPattern: [2, 6],
  fillStyleId: null,
  fontFamily: 'Inter',
  fontWeight: 700,
  italic: true,
  lineHeight: 40,
  letterSpacing: 2,
  textCase: 'UPPER'
} as const

describe('writing override claims', () => {
  test('claims on a scaled instance are written in its own space, as Figma reads them', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id)
    graph.createNode('TEXT', component.id, { text: 'Label', fillStyleId: '9:1' })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
    graph.updateNode(instance.id, { componentScale: 2 })
    const layerId = expectDefined(graph.getChildren(instance.id)[0], 'copy').id
    graph.updateNode(layerId, { ...CLAIMED, dashPattern: [...CLAIMED.dashPattern] })
    for (const field of Object.keys(CLAIMED) as (keyof typeof CLAIMED)[])
      setLayerOverride(graph, expectDefined(graph.getNode(layerId), 'copy'), field)

    const [change] = sceneNodeToKiwi(
      expectDefined(graph.getNode(instance.id), 'instance'),
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      [],
      { nodeIdToGuid: new Map(), assignedGuidValues: new Set() }
    )

    const claims = symbolDataOf(change)?.symbolOverrides ?? []
    expect(claims).toHaveLength(1)
    expect(claims[0]).toMatchObject({
      strokeWeight: 2,
      cornerRadius: 4,
      dashPattern: [1, 3],
      styleIdForFill: { guid: UNSET_GUID },
      fontName: { family: 'Inter', style: 'Bold Italic' },
      lineHeight: { value: 20, units: 'PIXELS' },
      letterSpacing: { value: 1, units: 'PIXELS' },
      textCase: 'UPPER'
    })
  })
})
