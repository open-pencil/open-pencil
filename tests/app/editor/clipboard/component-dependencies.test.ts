import { expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'

test('cross-document instance-only paste imports its component dependency', async () => {
  const source = createEditorStore()
  const component = source.graph.createNode('COMPONENT', source.state.currentPageId, {
    name: 'Dependency'
  })
  const componentChild = source.graph.createNode('RECTANGLE', component.id, {
    name: 'Dependency child'
  })
  const instance = source.graph.createNode('INSTANCE', source.state.currentPageId, {
    name: 'Instance only',
    componentId: component.id
  })
  source.graph.createNode('RECTANGLE', instance.id, {
    name: 'Instance child',
    componentId: componentChild.id
  })
  source.select([instance.id])
  const payload = await source.prepareCopy()
  if (!payload.snapshot) throw new Error('Missing snapshot')
  const target = createEditorStore()
  await target.pasteSnapshot(payload.snapshot)
  const pastedId = [...target.state.selectedIds][0]
  const pasted = target.graph.getNode(pastedId)
  const dependency = pasted?.componentId ? target.graph.getNode(pasted.componentId) : undefined
  expect(dependency?.type).toBe('COMPONENT')
  expect(dependency?.name).toBe('Dependency')
  const child = pasted?.childIds[0] ? target.graph.getNode(pasted.childIds[0]) : undefined
  expect(child?.componentId).toBe(dependency?.childIds[0])
  target.undo.undo()
  expect(target.graph.getNode(pastedId)).toBeUndefined()
  expect(target.graph.getNode(dependency?.id ?? '')).toBeUndefined()
  target.undo.redo()
  expect(target.graph.getNode(pastedId)?.componentId).toBe(dependency?.id)
})
