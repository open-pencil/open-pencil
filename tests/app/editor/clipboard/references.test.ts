import { expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'

test('pasting a component and instance together remaps their component references', async () => {
  const editor = createEditorStore()
  const page = editor.state.currentPageId
  const component = editor.graph.createNode('COMPONENT', page, { name: 'Master' })
  const child = editor.graph.createNode('RECTANGLE', component.id, { name: 'Master child' })
  const instance = editor.graph.createNode('INSTANCE', page, {
    name: 'Instance',
    componentId: component.id
  })
  const instanceChild = editor.graph.createNode('RECTANGLE', instance.id, {
    name: 'Instance child',
    componentId: child.id
  })
  instance.instanceOverrides.descendants.set(child.id, new Map([['name', 'Overridden']]))
  editor.select([component.id, instance.id])
  const payload = await editor.prepareCopy()
  if (!payload.snapshot) throw new Error('Missing snapshot')
  await editor.pasteSnapshot(payload.snapshot)
  const pasted = [...editor.state.selectedIds].map((id) => editor.graph.getNode(id))
  const master = pasted.find((node) => node?.type === 'COMPONENT')
  const copy = pasted.find((node) => node?.type === 'INSTANCE')
  if (!master || !copy) throw new Error('Missing pasted roots')
  const copiedChild = editor.graph.getNode(copy.childIds[0])
  if (!copiedChild) throw new Error('Missing pasted child')
  const masterChildId = master.childIds[0]
  expect(copy.componentId).toBe(master.id)
  expect(copiedChild.id).not.toBe(instanceChild.id)
  expect(copiedChild.componentId).toBe(masterChildId)
  expect(copy.instanceOverrides.descendants.has(masterChildId)).toBe(true)
  editor.undo.undo()
  expect(editor.graph.getNode(copy.id)).toBeUndefined()
  editor.undo.redo()
  expect(editor.graph.getNode(copy.id)?.componentId).toBe(master.id)
  expect(editor.graph.getNode(copiedChild.id)?.componentId).toBe(masterChildId)
})
