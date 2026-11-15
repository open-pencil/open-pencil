import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { encodeArchive, open } from '#core-tests/helpers/fig/archive'
import {
  boundGuid,
  definitionsOf,
  dotSet,
  guidOf,
  KIT_PROPERTY,
  kitStyleArchive,
  type SavedCopy,
  savedCopies,
  setRecord,
  variantRecords
} from '#core-tests/helpers/fig/component-sets'

import {
  FigmaAPI,
  type FigmaComponentNode,
  type FigmaComponentSetNode,
  type FigmaInstanceNode
} from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import type { GUID } from '@open-pencil/kiwi/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createComponentPropertyId } from '@open-pencil/scene-graph/components'
import { createSlotProperty } from '@open-pencil/scene-graph/slots'
import { expectDefined } from '@open-pencil/test-support/assert'

import { releaseFigArchive } from '#core/kiwi/fig/session/archive/access'

setDefaultTimeout(60_000)

/**
 * Figma (desktop 126) gives each variant its own copy of a set's boolean, text, swap, and slot
 * properties, linked by `parentPropDefId`; the variant's layers bind to the copy and an instance
 * assigns its variant's copy. A set saved without the copies opens with instances that lack
 * the property. Its scripts see the set's property alone, whichever variant shows.
 */
describe("a set's properties as each variant's linked copy", () => {
  test('a set made in OpenPencil writes a copy per variant, which its layers and instances name', async () => {
    const graph = await dotSet()

    const records = parseFigBuffer(
      (await exportFigFile(graph)).slice().buffer as ArrayBuffer
    ).nodeChanges
    const saved = setRecord(records)
    const property = definitionsOf(saved).find((definition) => definition.type === 'BOOL')
    const copies = variantRecords(records, saved).map((variant) => {
      const [copy] = (variant.componentPropDefs ?? []) as SavedCopy[]
      expect(guidOf(copy?.parentPropDefId)).toBe(guidOf(property?.id))
      const dot = records.find(
        (record) => guidOf(record.parentIndex?.guid) === guidOf(variant.guid)
      )
      expect(dot && boundGuid(dot, 'VISIBLE')).toBe(guidOf(copy?.id))
      return guidOf(copy?.id)
    })
    expect(new Set(copies).size).toBe(2)
    const written = expectDefined(
      records.find((record) => record.type === 'INSTANCE'),
      'instance record'
    )
    const [assignment] = (written.componentPropAssignments ?? []) as { defID?: GUID }[]
    expect(guidOf(assignment?.defID)).toBe(copies[1])

    // Read back, the set's property is the only one: scripts name it the same everywhere, the
    // instance keeps its value, and switching variant keeps it, as in Figma.
    const reopened = new FigmaAPI(await open(await exportFigFile(graph)))
    const readSet = expectDefined(
      reopened.currentPage.findOne(
        (node) => node.type === 'COMPONENT_SET'
      ) as FigmaComponentSetNode | null,
      'set'
    )
    const readKey = expectDefined(
      Object.keys(readSet.componentPropertyDefinitions).find((name) =>
        name.startsWith('Show dot#')
      ),
      'property key'
    )
    const readInstance = expectDefined(
      reopened.currentPage.findOne((node) => node.type === 'INSTANCE') as FigmaInstanceNode | null,
      'instance'
    )
    expect(Object.keys(readInstance.componentProperties).sort()).toEqual([readKey, 'Size'].sort())
    expect(readInstance.componentProperties[readKey]?.value).toBe(false)
    readInstance.setProperties({ Size: 'Small' })
    expect(readInstance.componentProperties[readKey]?.value).toBe(false)
    expect(expectDefined(readInstance.children[0], 'dot').visible).toBe(false)
  })

  // Untouched layers and instances keep naming the copies the archive saved, so a save writes
  // a variant's existing copies under their saved GUIDs, beside a copy of the new property.
  test('saving a set read from a .fig keeps its variants’ copies and adds new ones', async () => {
    const bytes = await exportFigFile(await dotSet())
    const before = savedCopies(parseFigBuffer(bytes.slice().buffer as ArrayBuffer).nodeChanges)
    const graph = await open(bytes)
    const set = expectDefined(
      new FigmaAPI(graph).currentPage.findOne(
        (node) => node.type === 'COMPONENT_SET'
      ) as FigmaComponentSetNode | null,
      'set'
    )
    set.addComponentProperty('Label', 'TEXT', 'Label')
    const after = savedCopies(
      parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer).nodeChanges
    )
    expect(after).toHaveLength(2)
    after.forEach((variant, index) => {
      expect(variant.copies['Show dot']).toBe(before[index]?.copies['Show dot'])
      expect(variant.dot).toBe(variant.copies['Show dot'])
      expect(variant.copies.Label).toBeTruthy()
    })
  })

  test('a property added to a set read from a .fig gives every variant a copy', async () => {
    const bytes = await kitStyleArchive()
    const saves: Uint8Array[] = []
    for (const keepArchive of [true, false]) {
      const graph = await open(bytes)
      if (!keepArchive) releaseFigArchive(graph)
      const figma = new FigmaAPI(graph)
      const set = expectDefined(
        figma.currentPage.findOne(
          (node) => node.type === 'COMPONENT_SET'
        ) as FigmaComponentSetNode | null,
        'set'
      )
      set.addComponentProperty('Label', 'TEXT', 'Label')
      saves.push(await exportFigFile(graph))
    }
    // Patched into the archive, and written in full.
    for (const saved of saves) {
      const records = parseFigBuffer(saved.slice().buffer as ArrayBuffer).nodeChanges
      const set = setRecord(records)
      const label = definitionsOf(set).find((definition) => definition.name === 'Label')
      const variants = variantRecords(records, set)
      expect(variants).toHaveLength(2)
      for (const variant of variants)
        expect(
          ((variant.componentPropDefs ?? []) as SavedCopy[]).map((copy) =>
            guidOf(copy.parentPropDefId)
          )
        ).toEqual([guidOf(label?.id)])
    }
  })

  // A copy of a nested instance links to the layer it was copied from, not to its variant, yet
  // the value its owner sets names that variant's copy, as a placed instance's does.
  test('a value set on a nested instance of a variant names that variant’s copy', async () => {
    const graph = await dotSet()
    const figma = new FigmaAPI(graph)
    const large = expectDefined(
      figma.currentPage.findOne((node) => node.name === 'Size=Large') as FigmaComponentNode | null,
      'large'
    )
    const card = figma.createComponent()
    card.name = 'Card'
    card.x = 400
    card.appendChild(large.createInstance())
    const placed = card.createInstance()
    placed.x = 600
    const nested = expectDefined(placed.children[0], 'nested') as FigmaInstanceNode
    const key = expectDefined(
      Object.keys(nested.componentProperties).find((name) => name.startsWith('Show dot#')),
      'property key'
    )
    nested.setProperties({ [key]: false })

    const records = parseFigBuffer(
      (await exportFigFile(graph)).slice().buffer as ArrayBuffer
    ).nodeChanges
    const largeCopy = savedCopies(records)[1]?.copies['Show dot']
    const placedRecord = expectDefined(
      records.find((record) => record.type === 'INSTANCE' && record.name === 'Card'),
      'placed card'
    )
    const assigned = symbolOverridesOf(placedRecord).flatMap(
      (override) => (override.componentPropAssignments ?? []) as { defID?: GUID }[]
    )
    expect(assigned.map((assignment) => guidOf(assignment.defID))).toEqual([largeCopy])
  })

  // A duplicate of a variant carries its original's saved copies; the original keeps their
  // GUIDs, which its untouched layers name, and the duplicate gets copies of its own.
  // An older OpenPencil saved a variant's properties on the variant itself, and a graph can still
  // hold one. Figma keeps every variant's properties on its set (desktop 126), so a save writes
  // them there and gives each variant a copy, which the variant's bound layers name.
  test('a property a variant defines itself is saved as its set’s', async () => {
    await initCodec()
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const set = graph.createNode('COMPONENT_SET', page, {
      name: 'Chip',
      componentPropertyDefinitions: [
        { id: 'prop:size', name: 'Size', type: 'VARIANT', defaultValue: 'Small' }
      ]
    })
    for (const size of ['Small', 'Large']) {
      const variant = graph.createNode('COMPONENT', set.id, {
        name: `Size=${size}`,
        componentPropertyValues: { Size: size },
        componentPropertyDefinitions:
          size === 'Large'
            ? [{ id: 'prop:dot', name: 'Show dot', type: 'BOOLEAN', defaultValue: 'true' }]
            : []
      })
      graph.createNode('RECTANGLE', variant.id, {
        name: 'Dot',
        componentPropertyReferences:
          size === 'Large' ? [{ field: 'VISIBLE', propertyId: 'prop:dot' }] : []
      })
    }

    const records = parseFigBuffer(
      (await exportFigFile(graph)).slice().buffer as ArrayBuffer
    ).nodeChanges
    expect(definitionsOf(setRecord(records)).map((definition) => definition.name)).toEqual([
      'Size',
      'Show dot'
    ])
    const written = savedCopies(records)
    expect(written.map(({ copies }) => Object.keys(copies))).toEqual([['Show dot'], ['Show dot']])
    expect(written[1]?.dot).toBe(written[1]?.copies['Show dot'])
  })

  // A slot made in one variant is its set's property, as any variant's is, so the set's record
  // defines what each variant's copy links to, and the save opens again.
  test('a slot made in a variant of a set read from a .fig is saved as its set’s', async () => {
    const bytes = await kitStyleArchive()
    for (const keepArchive of [true, false]) {
      const graph = await open(bytes)
      if (!keepArchive) releaseFigArchive(graph)
      const set = expectDefined(
        [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT_SET'),
        'set'
      )
      const variant = expectDefined(graph.getChildren(set.id)[0], 'variant')
      const frame = graph.createNode('FRAME', variant.id, { name: 'Thumb' })
      createSlotProperty(graph, frame.id, createComponentPropertyId())
      expect(graph.getNode(variant.id)?.componentPropertyDefinitions).toEqual([])

      const saved = await exportFigFile(graph)
      const records = parseFigBuffer(saved.slice().buffer as ArrayBuffer).nodeChanges
      const slot = definitionsOf(setRecord(records)).find(
        (definition) => definition.name === 'Thumb'
      )
      for (const record of variantRecords(records, setRecord(records)))
        expect(
          ((record.componentPropDefs ?? []) as SavedCopy[]).map((copy) =>
            guidOf(copy.parentPropDefId)
          )
        ).toEqual([guidOf(slot?.id)])
      const reread = await open(saved)
      const readSet = [...reread.getAllNodes()].find((node) => node.type === 'COMPONENT_SET')
      expect(readSet?.componentPropertyDefinitions.map((definition) => definition.name)).toContain(
        'Thumb'
      )
    }
  })

  // A graph can still hold a variant that defines a property itself after its set was read from
  // a .fig, whose saved definitions lack it; the set's record must define it all the same.
  test('a property a variant of a set read from a .fig defines itself is saved as its set’s', async () => {
    const bytes = await kitStyleArchive()
    for (const keepArchive of [true, false]) {
      const graph = await open(bytes)
      if (!keepArchive) releaseFigArchive(graph)
      const set = expectDefined(
        [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT_SET'),
        'set'
      )
      const variant = expectDefined(graph.getChildren(set.id)[0], 'variant')
      graph.updateNode(variant.id, {
        componentPropertyDefinitions: [
          { id: 'prop:dot', name: 'Show dot', type: 'BOOLEAN', defaultValue: 'true' }
        ]
      })

      const saved = await exportFigFile(graph)
      const records = parseFigBuffer(saved.slice().buffer as ArrayBuffer).nodeChanges
      expect(definitionsOf(setRecord(records)).map((definition) => definition.name)).toEqual([
        'State',
        'Show dot'
      ])
      expect(savedCopies(records).map(({ copies }) => Object.keys(copies))).toEqual([
        ['Show dot'],
        ['Show dot']
      ])
      expect(await open(saved)).toBeDefined()
    }
  })

  test('a duplicated variant gives its copies GUIDs of its own', async () => {
    const bytes = await exportFigFile(await dotSet())
    const before = savedCopies(parseFigBuffer(bytes.slice().buffer as ArrayBuffer).nodeChanges)
    for (const keepArchive of [true, false]) {
      const graph = await open(bytes)
      if (!keepArchive) releaseFigArchive(graph)
      const set = expectDefined(
        new FigmaAPI(graph).currentPage.findOne(
          (node) => node.type === 'COMPONENT_SET'
        ) as FigmaComponentSetNode | null,
        'set'
      )
      const large = expectDefined(
        set.children.find((child) => child.name === 'Size=Large'),
        'large'
      )
      const huge = large.clone()
      huge.name = 'Size=Huge'
      set.appendChild(huge)

      const after = savedCopies(
        parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer).nodeChanges
      )
      const copies = after.map(({ copies: own }) => own['Show dot'])
      expect(new Set(copies).size).toBe(3)
      // Each variant's dot binds its own variant's copy.
      expect(after.map(({ dot }) => dot)).toEqual(copies)
      if (keepArchive)
        expect(copies.slice(0, 2)).toEqual(before.map(({ copies: own }) => own['Show dot']))
    }
  })

  // A file OpenPencil wrote keeps copies under GUIDs from its own counter, which a later full
  // save must not mint again for a new property's copy.
  test('a full save mints new copies past the copies the file saved', async () => {
    const graph = await open(await exportFigFile(await dotSet()))
    releaseFigArchive(graph)
    const set = expectDefined(
      new FigmaAPI(graph).currentPage.findOne(
        (node) => node.type === 'COMPONENT_SET'
      ) as FigmaComponentSetNode | null,
      'set'
    )
    set.addComponentProperty('Label', 'TEXT', 'Label')

    const records = parseFigBuffer(
      (await exportFigFile(graph)).slice().buffer as ArrayBuffer
    ).nodeChanges
    const recordGuids = new Set(records.map((record) => guidOf(record.guid)))
    const copyIds = variantRecords(records, setRecord(records)).flatMap((variant) =>
      ((variant.componentPropDefs ?? []) as SavedCopy[]).map((copy) => guidOf(copy.id))
    )
    expect(copyIds).toHaveLength(4)
    expect(new Set(copyIds).size).toBe(4)
    expect(copyIds.filter((id) => recordGuids.has(id))).toEqual([])
  })

  // Figma's own property GUIDs may pass 31 bits; a full save writes the set's property and the
  // variants' copies under one GUID, and the file reads back with the property intact.
  test('a full save links copies to a property saved under a GUID past 31 bits', async () => {
    const parsed = parseFigBuffer(
      (await exportFigFile(await dotSet())).slice().buffer as ArrayBuffer
    )
    const set = setRecord(parsed.nodeChanges)
    const property = expectDefined(
      definitionsOf(set).find((definition) => definition.type === 'BOOL'),
      'boolean property'
    )
    const saved = guidOf(property.id)
    property.id = KIT_PROPERTY
    for (const variant of variantRecords(parsed.nodeChanges, set))
      for (const copy of (variant.componentPropDefs ?? []) as SavedCopy[])
        if (guidOf(copy.parentPropDefId) === saved) copy.parentPropDefId = KIT_PROPERTY
    const graph = await open(encodeArchive(parsed))
    releaseFigArchive(graph)

    const bytes = await exportFigFile(graph)
    const records = parseFigBuffer(bytes.slice().buffer as ArrayBuffer).nodeChanges
    const written = setRecord(records)
    const boolean = definitionsOf(written).find((definition) => definition.type === 'BOOL')
    const parents = variantRecords(records, written).flatMap((variant) =>
      ((variant.componentPropDefs ?? []) as SavedCopy[]).map((copy) => guidOf(copy.parentPropDefId))
    )
    expect(parents).toEqual([guidOf(boolean?.id), guidOf(boolean?.id)])
    const instance = expectDefined(
      new FigmaAPI(await open(bytes)).currentPage.findOne(
        (node) => node.type === 'INSTANCE'
      ) as FigmaInstanceNode | null,
      'instance'
    )
    const key = Object.keys(instance.componentProperties).find((name) =>
      name.startsWith('Show dot#')
    )
    expect(instance.componentProperties[key ?? '']?.value).toBe(false)
  })
})
