import { expect, test } from 'bun:test'

import {
  getInstanceOverride,
  instanceLayerId,
  recordInstanceOverride
} from '@open-pencil/scene-graph'

import { createEditorStore } from '@/app/editor/session/create'

test('pasting a component and instance together remaps their component references', async () => {
  const editor = createEditorStore()
  const page = editor.state.currentPageId
  const component = editor.graph.createNode('COMPONENT', page, { name: 'Master' })
  const child = editor.graph.createNode('RECTANGLE', component.id, { name: 'Master child' })
  const instance = editor.graph.createInstance(component.id, page)
  if (!instance) throw new Error('Missing instance')
  const instanceChildId = instanceLayerId(instance.id, [child.id])
  editor.graph.updateNode(instanceChildId, { name: 'Overridden' })
  recordInstanceOverride(editor.graph, instanceChildId, ['name'])
  editor.select([component.id, instance.id])
  const payload = await editor.prepareCopy()
  if (!payload.snapshot) throw new Error('Missing snapshot')
  await editor.pasteSnapshot(payload.snapshot)
  const pasted = [...editor.state.selectedIds].map((id) => editor.graph.getNode(id))
  const master = pasted.find((node) => node?.type === 'COMPONENT')
  const copy = pasted.find((node) => node?.type === 'INSTANCE')
  if (!master || !copy) throw new Error('Missing pasted roots')
  const masterChildId = master.childIds[0]
  const copiedChild = editor.graph.getNode(copy.childIds[0])
  if (!copiedChild) throw new Error('Missing pasted child')
  expect(copy.componentId).toBe(master.id)
  expect(copiedChild.id).toBe(instanceLayerId(copy.id, [masterChildId]))
  expect(copiedChild.name).toBe('Overridden')
  expect(getInstanceOverride(copy.instanceOverrides, [masterChildId], 'name')).toBe(true)
  editor.undo.undo()
  expect(editor.graph.getNode(copy.id)).toBeUndefined()
  editor.undo.redo()
  expect(editor.graph.getNode(copy.id)?.componentId).toBe(master.id)
  expect(editor.graph.getNode(copiedChild.id)?.name).toBe('Overridden')
})
