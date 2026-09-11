import { expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'

test('cross-document paste imports and remaps referenced shared styles', async () => {
  const source = createEditorStore()
  const definition = source.graph.createNode('RECTANGLE', source.state.currentPageId, {
    name: 'Brand/Primary',
    sharedStyleType: 'FILL',
    internalOnly: true
  })
  source.graph.preserveSourceMetadataDuring(() =>
    source.graph.updateNode(definition.id, {
      source: { ...definition.source, format: 'fig', id: 'source:style' }
    })
  )
  const node = source.graph.createNode('RECTANGLE', source.state.currentPageId, {
    fillStyleId: 'source:style'
  })
  source.select([node.id])
  const payload = await source.prepareCopy()
  if (!payload.snapshot) throw new Error('Missing snapshot')
  const target = createEditorStore()
  await target.pasteSnapshot(payload.snapshot)
  const pastedId = [...target.state.selectedIds][0]
  const styleId = target.graph.getNode(pastedId)?.fillStyleId
  expect(styleId).toBeString()
  expect(styleId).not.toBe('source:style')
  const imported = [...target.graph.getAllNodes()].find(
    (candidate) => candidate.source.id === styleId
  )
  expect(imported?.name).toBe('Brand/Primary')
  target.undo.undo()
  expect(target.graph.getNode(pastedId)).toBeUndefined()
  expect([...target.graph.getAllNodes()].some((candidate) => candidate.source.id === styleId)).toBe(
    false
  )
  target.undo.redo()
  expect(target.graph.getNode(pastedId)?.fillStyleId).toBe(styleId)
  expect([...target.graph.getAllNodes()].some((candidate) => candidate.source.id === styleId)).toBe(
    true
  )
})
