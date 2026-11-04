import { expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'

test('same-document instance paste retains its existing component', async () => {
  const editor = createEditorStore()
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
  const instance = editor.graph.createNode('INSTANCE', editor.state.currentPageId, {
    componentId: component.id
  })
  editor.select([instance.id])
  const { snapshot } = await editor.prepareCopy()
  if (!snapshot) throw new Error('Missing snapshot')
  await editor.pasteSnapshot(snapshot)
  const pasted = editor.graph.getNode([...editor.state.selectedIds][0])
  expect(pasted?.componentId).toBe(component.id)
  if (!pasted) throw new Error('Missing pasted instance')
  editor.undo.undo()
  expect(editor.graph.getNode(pasted.id)).toBeUndefined()
  expect(editor.graph.getNode(component.id)).toBe(component)
  editor.undo.redo()
  expect(editor.graph.getNode(pasted.id)?.componentId).toBe(component.id)
})

test('cross-document component dependency bindings resolve in the target', async () => {
  const source = createEditorStore()
  const collection = source.graph.createCollection('Spacing')
  const variable = source.graph.createVariable('Radius', 'FLOAT', collection.id, 12)
  const component = source.graph.createNode('COMPONENT', source.state.currentPageId, {
    boundVariables: { cornerRadius: variable.id }
  })
  source.graph.createNode('RECTANGLE', component.id, {
    boundVariables: { cornerRadius: variable.id }
  })
  const instance = source.graph.createNode('INSTANCE', source.state.currentPageId, {
    componentId: component.id
  })
  source.select([instance.id])
  const { snapshot } = await source.prepareCopy()
  if (!snapshot) throw new Error('Missing snapshot')
  const target = createEditorStore()
  await target.pasteSnapshot(snapshot)
  const pasted = target.graph.getNode([...target.state.selectedIds][0])
  const dependency = target.graph.getNode(pasted?.componentId ?? '')
  expect(target.graph.variables.has(dependency?.boundVariables.cornerRadius ?? '')).toBe(true)
  if (!pasted || !dependency) throw new Error('Missing imported instance or component')
  const child = target.graph.getNode(dependency.childIds[0])
  expect(child?.boundVariables.cornerRadius).toBe(dependency.boundVariables.cornerRadius)
  expect(snapshot.componentDependencies[0].boundVariables.cornerRadius).toBe(variable.id)
  target.undo.undo()
  expect(target.graph.getNode(dependency.id)).toBeUndefined()
  expect(target.graph.variables.size).toBe(0)
  target.undo.redo()
  expect(target.graph.getNode(pasted.id)?.componentId).toBe(dependency.id)
  expect(target.graph.variables.has(dependency.boundVariables.cornerRadius)).toBe(true)
})

test('same-document paste restores a component deleted after copying', async () => {
  const editor = createEditorStore()
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
  const instance = editor.graph.createNode('INSTANCE', editor.state.currentPageId, {
    componentId: component.id
  })
  editor.select([instance.id])
  const { snapshot } = await editor.prepareCopy()
  if (!snapshot) throw new Error('Missing snapshot')
  editor.graph.deleteNode(component.id)
  await editor.pasteSnapshot(snapshot)
  const pasted = editor.graph.getNode([...editor.state.selectedIds][0])
  const restored = editor.graph.getNode(pasted?.componentId ?? '')
  expect(restored?.type).toBe('COMPONENT')
  expect(restored?.id).not.toBe(component.id)
  if (!restored) throw new Error('Missing restored component')
  editor.undo.undo()
  expect(editor.graph.getNode(restored.id)).toBeUndefined()
  editor.undo.redo()
  expect(editor.graph.getNode(restored.id)?.type).toBe('COMPONENT')
})
