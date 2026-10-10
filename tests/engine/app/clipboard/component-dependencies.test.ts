import { expect, test } from 'bun:test'

import { instanceLayerId } from '@open-pencil/scene-graph'

import { createEditorStore } from '@/app/editor/session/create'

test('cross-document instance-only paste imports its component dependency', async () => {
  const source = createEditorStore()
  const component = source.graph.createNode('COMPONENT', source.state.currentPageId, {
    name: 'Dependency'
  })
  source.graph.createNode('RECTANGLE', component.id, {
    name: 'Dependency child'
  })
  const instance = source.graph.createInstance(component.id, source.state.currentPageId, {
    name: 'Instance only'
  })
  if (!instance) throw new Error('Missing instance')
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
  expect(pasted?.childIds).toEqual([instanceLayerId(pastedId, [dependency?.childIds[0] ?? ''])])
  target.undo.undo()
  expect(target.graph.getNode(pastedId)).toBeUndefined()
  expect(target.graph.getNode(dependency?.id ?? '')).toBeUndefined()
  target.undo.redo()
  expect(target.graph.getNode(pastedId)?.componentId).toBe(dependency?.id)
})
