import { expect, test } from 'bun:test'

import type { SymbolData } from '#fig/instance-overrides/types'

import { createEditor } from '@open-pencil/core/editor'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { hasInstanceOverride } from '@open-pencil/scene-graph'

import fixture from '#tests/fixtures/nested-layout-scale.json'

function assembly(phase: 'before' | 'edited') {
  return materializeDocument(
    [{ guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT' }, ...fixture[phase]] as NodeChange[],
    fixture.blobs.map((value) => Uint8Array.fromBase64(value)),
    { derivedBounds: true }
  )
}

for (const phase of ['before', 'edited'] as const) {
  test(`nested Figma scale composes once and preserves ${phase} layout`, () => {
    const { graph, sources } = assembly(phase)
    const id = sources.get(fixture.ids.instance)
    if (!id) throw new Error('Missing placed instance')
    const root = graph.getNode(id)
    const nested = graph.getChildren(id)[0]
    const rectangle = graph.getChildren(nested.id)[0]
    expect(root?.paddingLeft).toBe(phase === 'before' ? 10 : 13)
    expect(nested.paddingLeft).toBe(phase === 'before' ? 2.5 : 7)
    expect(nested.itemSpacing).toBe(1.5)
    expect(rectangle.width).toBe(5)
    computeAllLayouts(graph)
    expect(root?.width).toBe(phase === 'before' ? 30 : 37.5)
    expect(nested.width).toBe(phase === 'before' ? 10 : 14.5)
    expect(rectangle.x).toBe(phase === 'before' ? 2.5 : 7)
    expect(rectangle.width).toBe(5)
  })
}

test('scaled padding edits undo and export in the declaring owner space', async () => {
  await initCodec()
  const { graph, sources } = assembly('before')
  const id = sources.get(fixture.ids.instance)
  if (!id) throw new Error('Missing placed instance')
  const nested = graph.getChildren(id)[0]
  const editor = createEditor({ graph })
  expect(hasInstanceOverride(graph, nested.id, 'paddingLeft')).toBe(false)
  editor.updateNodeWithUndo(nested.id, { paddingLeft: 7 })
  expect(nested.paddingLeft).toBe(7)
  expect(hasInstanceOverride(graph, nested.id, 'paddingLeft')).toBe(true)
  editor.undo.undo()
  expect(nested.paddingLeft).toBe(2.5)
  expect(hasInstanceOverride(graph, nested.id, 'paddingLeft')).toBe(false)
  editor.undo.redo()
  expect(nested.paddingLeft).toBe(7)
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  const saved = parsed.nodeChanges.find(
    (node) => node.type === 'INSTANCE' && node.name === 'Scaled outer'
  )
  expect(saved).toBeDefined()
  const overrides = (saved?.symbolData as SymbolData | undefined)?.symbolOverrides ?? []
  expect(overrides.some((override) => override.stackHorizontalPadding === 14)).toBe(true)
  const { graph: reopened } = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    derivedBounds: true
  })
  const placed = reopened
    .getAllNodes()
    .find((node) => node.type === 'INSTANCE' && node.name === 'Scaled outer')
  if (!placed) throw new Error('Missing reopened instance')
  expect(reopened.getChildren(placed.id)[0].paddingLeft).toBe(7)
})
