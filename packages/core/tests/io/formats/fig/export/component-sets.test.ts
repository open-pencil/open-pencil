import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { deflateSync } from 'fflate'

import { buildFigmaClipboardHTML } from '@open-pencil/core/clipboard'
import { createEditor } from '@open-pencil/core/editor'
import {
  FigmaAPI,
  type FigmaComponentNode,
  type FigmaComponentSetNode,
  type FigmaInstanceNode,
  type FigmaRectangleNode
} from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { compressFigDataSync, parseFigBuffer } from '@open-pencil/fig'
import { parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import type { GUID } from '@open-pencil/kiwi/fig'
import {
  getCompiledSchema,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'
import { buildConnectorSublayers } from '@open-pencil/scene-graph/connectors'
import { parseVariantName } from '@open-pencil/scene-graph/variant-name'

import { releaseFigArchive } from '#core/kiwi/fig/session/archive/access'

setDefaultTimeout(60_000)

interface SavedDefinition {
  id?: GUID
  name?: string
  type?: string
  preferredValues?: unknown
}

interface SavedSpec {
  propDefId?: GUID
  value?: string
}

/** The Kiwi codec types these fields loosely; read the saved definitions and specs through here. */
const definitionsOf = (record: NodeChange) => (record.componentPropDefs ?? []) as SavedDefinition[]
const specsOf = (record: NodeChange) => (record.variantPropSpecs ?? []) as SavedSpec[]

/** The GUID the shadcn/ui kit's Checkbox gives its Interaction property: past 31 bits. */
const KIT_PROPERTY = { sessionID: 2583624281, localID: 1250876564 }

/**
 * A switch set saved as the shadcn/ui kit saves its sets: its variant property under a GUID
 * Figma made past 31 bits, no preferred values, and the values' order saved apart.
 */
async function kitStyleArchive(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  const figma = new FigmaAPI(source)
  const off = figma.createComponent()
  off.name = 'State=Off'
  const on = figma.createComponent()
  on.name = 'State=On'
  on.x = 100
  figma.combineAsVariants([off, on], figma.currentPage)
  const parsed = parseFigBuffer((await exportFigFile(source)).slice().buffer as ArrayBuffer)
  const set = setRecord(parsed.nodeChanges)
  set.isStateGroup = true
  const [definition] = definitionsOf(set)
  const saved = guidToString(expectDefined(definition.id, 'definition id'))
  definition.id = KIT_PROPERTY
  delete definition.preferredValues
  set.stateGroupPropertyValueOrders = [{ property: 'State', values: ['On', 'Off'] }]
  for (const record of parsed.nodeChanges)
    for (const spec of specsOf(record))
      if (spec.propDefId && guidToString(spec.propDefId) === saved) spec.propDefId = KIT_PROPERTY
  return encodeArchive(parsed)
}

/** A parsed archive written back as a .fig, after a test edited its records. */
function encodeArchive(parsed: ReturnType<typeof parseFigBuffer>): Uint8Array {
  const kiwi = getCompiledSchema().encodeMessage({
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges: parsed.nodeChanges
  })
  return compressFigDataSync(
    deflateSync(getSchemaBytes()),
    kiwi,
    expectDefined(parsed.thumbnailPNG, 'thumbnail'),
    parsed.metaJSON ?? '{}',
    []
  )
}

/** The set's record: the one whose properties include a variant property. */
function setRecord(records: NodeChange[]): NodeChange {
  return expectDefined(
    records.find((record) => definitionsOf(record).some((def) => def.type === 'VARIANT')),
    'set record'
  )
}

const open = (bytes: Uint8Array) =>
  parseFigFile(bytes.slice().buffer as ArrayBuffer, { populate: 'first-page' })

/** Splits Invalid out as its own property and turns it on for one variant, as the kit adapts. */
function addInvalid(graph: SceneGraph): void {
  const figma = new FigmaAPI(graph)
  const set = expectDefined(
    figma.currentPage.findOne(
      (node) => node.type === 'COMPONENT_SET'
    ) as FigmaComponentSetNode | null,
    'set'
  )
  set.addComponentProperty('Invalid', 'VARIANT', 'Off')
  const on = expectDefined(
    set.children.find((variant) => variant.name.startsWith('State=On')),
    'on variant'
  )
  on.name = 'State=On, Invalid=On'
}

/** Each variant's saved specs, by property name, and its name's values. */
function savedVariants(bytes: Uint8Array) {
  const records = parseFigBuffer(bytes.slice().buffer as ArrayBuffer).nodeChanges
  const set = setRecord(records)
  const names = new Map(
    definitionsOf(set).map((definition) => [
      guidToString(expectDefined(definition.id, 'definition id')),
      definition.name
    ])
  )
  const setGuid = guidToString(expectDefined(set.guid, 'set guid'))
  const variants = records.filter(
    (record: NodeChange) =>
      record.parentIndex?.guid && guidToString(record.parentIndex.guid) === setGuid
  )
  return {
    set,
    variants: variants.map((record) => ({
      name: parseVariantName(record.name ?? ''),
      specs: Object.fromEntries(
        specsOf(record).map((spec) => [
          names.get(guidToString(expectDefined(spec.propDefId, 'spec property'))) ?? 'unknown',
          spec.value
        ])
      )
    }))
  }
}

// Without the flag Figma (desktop 126) reads the set as a plain frame of loose components, and
// an instance of one variant has no properties; it lists the values in the saved order.
test('a set made in OpenPencil is written as a set Figma reads', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const variants = ['State=Off', 'State=On'].map((name, index) => {
    const component = figma.createComponent()
    component.name = name
    component.x = index * 100
    return component
  })
  figma.combineAsVariants(variants, figma.currentPage)
  const saved = await exportFigFile(graph)
  const set = setRecord(parseFigBuffer(saved.slice().buffer as ArrayBuffer).nodeChanges)
  expect(set.isStateGroup).toBe(true)
  expect(set.stateGroupPropertyValueOrders).toEqual([{ property: 'State', values: ['Off', 'On'] }])
})

interface SavedCopy {
  id?: GUID
  parentPropDefId?: GUID
}

const guidOf = (guid: unknown) => (guid ? guidToString(guid as GUID) : null)

/** The GUID a record's parameter map binds a field to. */
function boundGuid(record: NodeChange, field: string): string | null {
  const entries = (record.parameterConsumptionMap?.entries ?? []) as {
    variableField?: string
    variableData?: { value?: { propRefValue?: { defId?: GUID } } }
  }[]
  const entry = entries.find((item) => item.variableField === field)
  return guidOf(entry?.variableData?.value?.propRefValue?.defId)
}

/** A set's variants' records, in order. */
function variantRecords(records: NodeChange[], set: NodeChange): NodeChange[] {
  const setGuid = guidOf(set.guid)
  return records.filter((record) => guidOf(record.parentIndex?.guid) === setGuid)
}

/**
 * A Size set whose variants each show a dot bound to its Show dot boolean, and an instance of
 * the large one with the dot turned off.
 */
async function dotSet(): Promise<SceneGraph> {
  await initCodec()
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const dots: FigmaRectangleNode[] = []
  const variants = ['Size=Small', 'Size=Large'].map((name, index) => {
    const component = figma.createComponent()
    component.name = name
    component.x = index * 100
    const dot = figma.createRectangle()
    dot.name = 'Dot'
    component.appendChild(dot)
    dots.push(dot)
    return component
  })
  const set = figma.combineAsVariants(variants, figma.currentPage)
  const key = set.addComponentProperty('Show dot', 'BOOLEAN', true)
  for (const dot of dots) dot.componentPropertyReferences = { visible: key }
  const instance = expectDefined(variants[1], 'large').createInstance()
  instance.setProperties({ [key]: false })
  return graph
}

/** Each variant's copies, by the name of the set property each copies, and its dot's binding. */
function savedCopies(records: NodeChange[]) {
  const set = setRecord(records)
  const names = new Map(
    definitionsOf(set).map((definition) => [guidOf(definition.id), definition.name])
  )
  return variantRecords(records, set).map((variant) => {
    const dot = records.find((record) => guidOf(record.parentIndex?.guid) === guidOf(variant.guid))
    return {
      copies: Object.fromEntries(
        ((variant.componentPropDefs ?? []) as SavedCopy[]).map((copy) => [
          names.get(guidOf(copy.parentPropDefId)),
          guidOf(copy.id)
        ])
      ),
      dot: dot ? boundGuid(dot, 'VISIBLE') : null
    }
  })
}

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

    const records = parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
      .nodeChanges
    expect(definitionsOf(setRecord(records)).map((definition) => definition.name)).toEqual([
      'Size',
      'Show dot'
    ])
    const written = savedCopies(records)
    expect(written.map(({ copies }) => Object.keys(copies))).toEqual([['Show dot'], ['Show dot']])
    expect(written[1]?.dot).toBe(written[1]?.copies['Show dot'])
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
      if (keepArchive) expect(copies.slice(0, 2)).toEqual(before.map(({ copies: own }) => own['Show dot']))
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

    const records = parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
      .nodeChanges
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
    const parsed = parseFigBuffer((await exportFigFile(await dotSet())).slice().buffer as ArrayBuffer)
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

  // The clipboard writes each copied layer in a call of its own; a set copied with an instance
  // of it still gives the instance the copy its variant defines.
  test('a copied instance names the copy its copied variant defines', async () => {
    const graph = await dotSet()
    const figma = new FigmaAPI(graph)
    const set = expectDefined(
      figma.currentPage.findOne((node) => node.type === 'COMPONENT_SET'),
      'set'
    )
    const instance = expectDefined(
      figma.currentPage.findOne((node) => node.type === 'INSTANCE'),
      'instance'
    )
    const html = await buildFigmaClipboardHTML(
      [set.id, instance.id].map((id) => expectDefined(graph.getNode(id), id)),
      graph
    )
    const records = expectDefined(await parseFigmaClipboard(expectDefined(html, 'html')), 'parsed')
      .nodes
    const largeCopy = savedCopies(records)[1]?.copies['Show dot']
    const written = expectDefined(
      records.find((record) => record.type === 'INSTANCE'),
      'instance record'
    )
    const [assignment] = (written.componentPropAssignments ?? []) as { defID?: GUID }[]
    expect(guidOf(assignment?.defID)).toBe(largeCopy)
  })

  // Figma (desktop 126) copies an instance of a variant with the variant's whole set, which
  // defines what its copies link to; pasted, the instance keeps its value.
  test('a copied instance of a variant brings its set and pastes with its value', async () => {
    const graph = await dotSet()
    const instance = expectDefined(
      [...graph.getAllNodes()].find((node) => node.type === 'INSTANCE'),
      'instance'
    )
    const html = expectDefined(await buildFigmaClipboardHTML([instance], graph), 'html')
    const records = expectDefined(await parseFigmaClipboard(html), 'parsed').nodes
    expect(variantRecords(records, setRecord(records))).toHaveLength(2)

    const target = createEditor()
    await target.pasteFromHTML(html)
    const pasted = expectDefined(
      new FigmaAPI(target.graph).currentPage.findOne(
        (node) => node.type === 'INSTANCE'
      ) as FigmaInstanceNode | null,
      'pasted instance'
    )
    const key = Object.keys(pasted.componentProperties).find((name) => name.startsWith('Show dot#'))
    expect(pasted.componentProperties[key ?? '']?.value).toBe(false)
    expect(expectDefined(pasted.children[0], 'dot').visible).toBe(false)
  })

  // The set an instance brings would write a copied variant a second time under one GUID.
  test('a variant copied with an instance of its sibling pastes once', async () => {
    const graph = await dotSet()
    const nodes = [...graph.getAllNodes()]
    const large = expectDefined(
      nodes.find((node) => node.name === 'Size=Large'),
      'large'
    )
    const small = expectDefined(
      nodes.find((node) => node.name === 'Size=Small'),
      'small'
    )
    const sibling = expectDefined(graph.createInstance(small.id, graph.getPages()[0].id), 'sibling')
    const html = expectDefined(await buildFigmaClipboardHTML([large, sibling], graph), 'html')
    const records = expectDefined(await parseFigmaClipboard(html), 'parsed').nodes
    const guids = records.map((record) => guidOf(record.guid))
    expect(new Set(guids).size).toBe(guids.length)

    // As Figma copies it (desktop 126), the set keeps every variant, the copied one under a
    // new GUID keyed by its page record's.
    const pageLarge = expectDefined(
      records.find(
        (record) => record.name === 'Size=Large' && guidOf(record.parentIndex?.guid) === '0:1'
      ),
      'page variant'
    )
    const inSet = variantRecords(records, setRecord(records))
    expect(inSet.map((variant) => variant.name)).toEqual(['Size=Small', 'Size=Large'])
    expect(guidOf(inSet[1]?.overrideKey as GUID | undefined)).toBe(guidOf(pageLarge.guid))

    const target = createEditor()
    await target.pasteFromHTML(html)
    const pasted = [...target.graph.getAllNodes()]
    expect(pasted.filter((node) => node.type === 'INSTANCE')).toHaveLength(1)
    expect(pasted.some((node) => node.name === 'Size=Large' && node.type === 'COMPONENT')).toBe(
      true
    )
  })

  // A layer copied out of a variant stays in that variant's copy in the set an instance brings.
  test('a layer copied out of a variant stays in the set its instance brings', async () => {
    const graph = await dotSet()
    const nodes = [...graph.getAllNodes()]
    const large = expectDefined(
      nodes.find((node) => node.name === 'Size=Large'),
      'large'
    )
    const mark = graph.createNode('RECTANGLE', large.id, { name: 'Mark', width: 4, height: 4 })
    const instance = expectDefined(
      nodes.find((node) => node.type === 'INSTANCE'),
      'instance'
    )
    graph.syncInstances(large.id)
    const html = expectDefined(await buildFigmaClipboardHTML([mark, instance], graph), 'html')
    const records = expectDefined(await parseFigmaClipboard(html), 'parsed').nodes
    const guids = records.map((record) => guidOf(record.guid))
    expect(new Set(guids).size).toBe(guids.length)

    const target = createEditor()
    await target.pasteFromHTML(html)
    const pasted = expectDefined(
      [...target.graph.getAllNodes()].find((node) => node.type === 'INSTANCE'),
      'pasted instance'
    )
    const variant = expectDefined(target.graph.getMainComponent(pasted.id), 'pasted variant')
    expect(target.graph.getChildren(variant.id).map((layer) => layer.name)).toEqual([
      'Dot',
      'Mark'
    ])
  })

  test('a connector in the set an instance brings joins the layers written beside it', async () => {
    const graph = await dotSet()
    const nodes = [...graph.getAllNodes()]
    const large = expectDefined(
      nodes.find((node) => node.name === 'Size=Large'),
      'large'
    )
    const mark = graph.createNode('RECTANGLE', large.id, { name: 'Mark', width: 4, height: 4 })
    const end = (nodeId: string) => ({ nodeId, magnet: 'CENTER' as const, position: { x: 0, y: 0 } })
    const dot = expectDefined(graph.getChildren(large.id)[0], 'dot')
    const link = graph.createNode('CONNECTOR', large.id, {
      name: 'Link',
      connectorStart: end(dot.id),
      connectorEnd: end(mark.id)
    })
    buildConnectorSublayers(graph, link)
    const instance = expectDefined(
      nodes.find((node) => node.type === 'INSTANCE'),
      'instance'
    )
    graph.syncInstances(large.id)
    const html = expectDefined(await buildFigmaClipboardHTML([mark, instance], graph), 'html')
    const records = expectDefined(await parseFigmaClipboard(html), 'parsed').nodes

    const variant = expectDefined(variantRecords(records, setRecord(records))[1], 'large copy')
    const inVariant = records.filter(
      (record) => guidOf(record.parentIndex?.guid) === guidOf(variant.guid)
    )
    const written = expectDefined(
      inVariant.find((record) => record.type === 'CONNECTOR'),
      'connector'
    )
    const markCopy = expectDefined(
      inVariant.find((record) => record.name === 'Mark'),
      'mark copy'
    )
    expect(written.connectorEnd).toMatchObject({ endpointNodeID: markCopy.guid })
  })

  // Figma (desktop 126) writes a variant copied alone with its set's properties as its own,
  // under its copies' GUIDs, so it pastes as a component its layers still bind to.
  test('a copied variant pastes as a component defining its set’s properties', async () => {
    const graph = await dotSet()
    const large = expectDefined(
      [...graph.getAllNodes()].find((node) => node.name === 'Size=Large'),
      'large'
    )
    const html = expectDefined(await buildFigmaClipboardHTML([large], graph), 'html')

    const target = createEditor()
    await target.pasteFromHTML(html)
    const pasted = expectDefined(
      [...target.graph.getAllNodes()].find((node) => node.type === 'COMPONENT'),
      'pasted component'
    )
    const [definition] = pasted.componentPropertyDefinitions
    expect(pasted.componentPropertyDefinitions.map((def) => [def.name, def.type])).toEqual([
      ['Show dot', 'BOOLEAN']
    ])
    const dot = expectDefined(target.graph.getChildren(pasted.id)[0], 'dot')
    expect(dot.componentPropertyReferences).toEqual([
      { field: 'VISIBLE', propertyId: definition?.id }
    ])
  })
})

describe('saving variants edited in a set read from a .fig', () => {
  test('writes each variant’s values under its set’s properties', async () => {
    const bytes = await kitStyleArchive()
    const patchedGraph = await open(bytes)
    addInvalid(patchedGraph)
    const patched = await exportFigFile(patchedGraph)
    const fullGraph = await open(bytes)
    addInvalid(fullGraph)
    releaseFigArchive(fullGraph)
    const full = await exportFigFile(fullGraph)

    for (const saved of [patched, full]) {
      const { set, variants } = savedVariants(saved)
      // Every spec names one of the set's properties and agrees with the variant's name.
      expect(variants.map((variant) => variant.specs)).toEqual(
        variants.map((variant) => variant.name)
      )
      expect(variants.map((variant) => variant.name)).toEqual([
        { State: 'Off', Invalid: 'Off' },
        { State: 'On', Invalid: 'On' }
      ])
      // Figma lists a set's values in this order, and reads a frame without the flag as a plain
      // frame (desktop 126): the order is written again for the properties the set has now.
      expect(set.isStateGroup).toBe(true)
      expect(set.stateGroupPropertyValueOrders).toEqual([
        { property: 'State', values: ['On', 'Off'] },
        { property: 'Invalid', values: ['Off', 'On'] }
      ])
      const reopened = await open(saved)
      const values = [...reopened.nodes.values()]
        .filter((node) => node.type === 'COMPONENT')
        .map((node) => node.componentPropertyValues)
      expect(values).toEqual(variants.map((variant) => variant.name))
    }
    // Written into the archive, the set keeps the property's GUID the untouched records use.
    const { set } = savedVariants(patched)
    const state = definitionsOf(set).find((definition) => definition.name === 'State')
    expect(state?.id).toEqual(KIT_PROPERTY)
  })
})
