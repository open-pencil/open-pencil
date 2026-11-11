import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import {
  dotSet,
  guidOf,
  savedCopies,
  setRecord,
  variantRecords
} from '#core-tests/helpers/fig/component-sets'

import { buildFigmaClipboardHTML } from '@open-pencil/core/clipboard'
import { FigmaAPI, type FigmaInstanceNode } from '@open-pencil/core/figma-api'
import { parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import type { GUID } from '@open-pencil/kiwi/fig'
import { buildConnectorSublayers } from '@open-pencil/scene-graph/connectors'
import { expectDefined } from '@open-pencil/test-support/assert'

import { createEditor } from '#core/editor'

setDefaultTimeout(60_000)

/** A set copied to the clipboard with its variants' copies of its properties, as Figma copies it. */
describe("a set's properties as each variant's linked copy, copied", () => {
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
    const records = expectDefined(
      await parseFigmaClipboard(expectDefined(html, 'html')),
      'parsed'
    ).nodes
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
    expect(target.graph.getChildren(variant.id).map((layer) => layer.name)).toEqual(['Dot', 'Mark'])
  })

  test('a connector in the set an instance brings joins the layers written beside it', async () => {
    const graph = await dotSet()
    const nodes = [...graph.getAllNodes()]
    const large = expectDefined(
      nodes.find((node) => node.name === 'Size=Large'),
      'large'
    )
    const mark = graph.createNode('RECTANGLE', large.id, { name: 'Mark', width: 4, height: 4 })
    const end = (nodeId: string) => ({
      nodeId,
      magnet: 'CENTER' as const,
      position: { x: 0, y: 0 }
    })
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
