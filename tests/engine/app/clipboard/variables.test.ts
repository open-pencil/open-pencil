import { expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'

test('cross-document paste imports variable aliases and undoes definitions with the pasted nodes', async () => {
  const source = createEditorStore()
  const collection = source.graph.createCollection('Spacing')
  const alternateModeId = crypto.randomUUID()
  source.graph.addMode(collection.id, alternateModeId, 'Comfortable')
  source.graph.activeMode.set(collection.id, alternateModeId)
  const base = source.graph.createVariable('Base', 'FLOAT', collection.id, 12)
  const alias = source.graph.createVariable('Alias', 'FLOAT', collection.id, { aliasId: base.id })
  const node = source.graph.createNode('RECTANGLE', source.state.currentPageId, {
    boundVariables: { cornerRadius: alias.id }
  })
  source.graph.updateNode(node.id, { variableModes: { [collection.id]: alternateModeId } })
  source.select([node.id])
  const payload = await source.prepareCopy()
  if (!payload.snapshot) throw new Error('Missing snapshot')
  const target = createEditorStore()
  await target.pasteSnapshot(payload.snapshot)
  const pastedId = [...target.state.selectedIds][0]
  const pasted = target.graph.getNode(pastedId)
  const importedId = pasted?.boundVariables.cornerRadius
  if (!importedId) throw new Error('Missing imported binding')
  expect(importedId).not.toBe(alias.id)
  const imported = target.graph.variables.get(importedId)
  if (!imported) throw new Error('Missing imported variable')
  expect(Object.keys(imported.valuesByMode)).not.toContain(alternateModeId)
  const importedCollection = target.graph.variableCollections.get(imported.collectionId)
  if (!importedCollection) throw new Error('Missing imported collection')
  expect(importedCollection.modes.map((mode) => mode.modeId)).not.toContain(alternateModeId)
  expect(target.graph.getActiveModeId(importedCollection.id)).toBe(
    target.graph.getNode(pastedId)?.variableModes[importedCollection.id]
  )
  const value = Object.values(imported.valuesByMode)[0]
  if (typeof value !== 'object' || !('aliasId' in value)) throw new Error('Missing alias')
  expect(target.graph.variables.get(value.aliasId)?.name).toBe('Base')
  expect(target.graph.variableCollections.size).toBe(1)
  target.undo.undo()
  expect(target.graph.getNode(pastedId)).toBeUndefined()
  expect(target.graph.variables.size).toBe(0)
  expect(target.graph.variableCollections.size).toBe(0)
  target.undo.redo()
  expect(target.graph.getNode(pastedId)?.boundVariables.cornerRadius).toBe(importedId)
  expect(target.graph.variables.size).toBe(2)
})
