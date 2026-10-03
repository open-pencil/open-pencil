import { describe, expect, test } from 'bun:test'

import { createEditor, graphFromPageSnapshot } from '@open-pencil/core/editor'
import {
  comparePNGs,
  createCanvasKitRasterCodec,
  initCanvasKit,
  renderRegionToImage
} from '@open-pencil/core/io/formats/raster'

import { expectDefined } from '#core-tests/helpers/assert'

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
