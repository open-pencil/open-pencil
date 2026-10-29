import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor, graphFromPageSnapshot } from '@open-pencil/core'
import {
  comparePNGs,
  createCanvasKitRasterCodec,
  initCanvasKit,
  renderRegionToImage
} from '@open-pencil/core/io/formats/raster'

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('FRAME', pageId, { name: 'Card', width: 120, height: 80 })
  const label = editor.graph.createNode('TEXT', card.id, { name: 'Label', text: 'Hello' })
  return { editor, pageId, card, label }
}

describe('page snapshot graphs', () => {
  test('rebuilds the past page apart from the live document', () => {
    const { editor, pageId, label } = setup()
    const before = editor.snapshotPage(pageId)
    editor.graph.updateNode(label.id, { text: 'Changed' })

    const past = expectDefined(graphFromPageSnapshot(editor.graph, before), 'past graph')
    expect(past.getNode(label.id)?.text).toBe('Hello')
    past.updateNode(label.id, { text: 'Edited copy' })
    expect(editor.graph.getNode(label.id)?.text).toBe('Changed')
  })

  test('restores and rebuilds the variables the page had, keeping live records in place', () => {
    const { editor, pageId } = setup()
    const kept = editor.graph.createCollection('Kept')
    const before = editor.snapshotPage(pageId)
    const keptRecord = editor.graph.variableCollections.get(kept.id)
    editor.graph.renameMode(kept.id, kept.defaultModeId, 'Renamed')
    const added = editor.graph.createCollection('Added')
    editor.graph.createVariable('Ink', 'COLOR', added.id)

    const past = expectDefined(graphFromPageSnapshot(editor.graph, before), 'past graph')
    expect([...past.variableCollections.values()].map((item) => item.name)).toEqual(['Kept'])

    editor.restorePageFromSnapshot(before)
    expect([...editor.graph.variableCollections.values()].map((item) => item.name)).toEqual([
      'Kept'
    ])
    expect(editor.graph.variables.size).toBe(0)
    expect(editor.graph.variableCollections.get(kept.id)).toBe(keptRecord)
    expect(keptRecord?.modes[0].name).toBe('Mode 1')
  })

  test('gives layers on other pages the values of the variables it restores', () => {
    const { editor, pageId } = setup()
    const collection = editor.graph.createCollection('Shape')
    const radius = editor.graph.createVariable('Radius', 'FLOAT', collection.id, 12)
    const other = editor.graph.addPage('Other')
    const tile = editor.graph.createNode('FRAME', other.id, { name: 'Tile', cornerRadius: 12 })
    editor.graph.bindVariable(tile.id, 'cornerRadius', radius.id)
    const before = editor.snapshotPage(pageId)
    editor.updateVariableValue(radius.id, collection.defaultModeId, 16)
    expect(editor.graph.getNode(tile.id)?.cornerRadius).toBe(16)

    editor.restorePageFromSnapshot(before)
    expect(editor.graph.getNode(tile.id)?.cornerRadius).toBe(12)
  })

  test('renders both states of a region at one size and finds the changed pixels', async () => {
    const { editor, pageId, card } = setup()
    editor.graph.updateNode(card.id, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const before = editor.snapshotPage(pageId)
    editor.graph.updateNode(card.id, {
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const after = editor.snapshotPage(pageId)

    const ck = await initCanvasKit()
    const codec = createCanvasKitRasterCodec(ck)
    const bounds = { minX: -10, minY: -10, maxX: 130, maxY: 90 }
    const render = async (snapshot: typeof before) =>
      expectDefined(
        await renderRegionToImage(
          ck,
          expectDefined(graphFromPageSnapshot(editor.graph, snapshot), 'graph'),
          pageId,
          bounds,
          0.5
        ),
        'region PNG'
      )

    const unchanged = expectDefined(
      comparePNGs(codec, await render(before), await render(before)),
      'same'
    )
    expect(unchanged).toMatchObject({ width: 70, height: 50, changedPixels: 0, mask: null })

    const changed = expectDefined(
      comparePNGs(codec, await render(before), await render(after)),
      'changed'
    )
    expect(changed.changedPixels / changed.totalPixels).toBeGreaterThan(0.5)
    expect(changed.mask).toBeInstanceOf(Uint8Array)
  })
})
