import type { Ref } from 'vue'

import { BLACK } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { VariableCollection, VariableType, VariableValue } from '@open-pencil/scene-graph'
import { randomHex } from '@open-pencil/scene-graph/random'

export function createVariableCollectionActions(editor: Editor, activeCollectionId: Ref<string>) {
  function setActiveCollection(id: string) {
    activeCollectionId.value = id
  }

  function addCollection() {
    const id = `col:${randomHex(8)}`
    const collection: VariableCollection = {
      id,
      name: 'New collection',
      modes: [{ modeId: 'default', name: 'Mode 1' }],
      defaultModeId: 'default',
      variableIds: []
    }
    editor.addCollection(collection)
    activeCollectionId.value = id
  }

  function renameCollection(id: string, newName: string) {
    editor.renameCollection(id, newName)
  }

  function removeCollection(id: string) {
    editor.removeCollection(id)
    const cols = [...editor.getCollections()]
    activeCollectionId.value = cols[0]?.id ?? ''
  }

  function addMode(): string | undefined {
    const colId = activeCollectionId.value
    if (!colId) return undefined
    return editor.addMode(colId)
  }

  function removeMode(modeId: string) {
    const colId = activeCollectionId.value
    if (!colId) return
    editor.removeMode(colId, modeId)
  }

  function renameMode(modeId: string, newName: string) {
    const colId = activeCollectionId.value
    if (!colId) return
    editor.renameMode(colId, modeId, newName)
  }

  function setDefaultMode(modeId: string) {
    const colId = activeCollectionId.value
    if (!colId) return
    editor.setDefaultMode(colId, modeId)
  }

  function duplicateMode(modeId: string): string | undefined {
    const colId = activeCollectionId.value
    if (!colId) return undefined
    return editor.duplicateMode(colId, modeId)
  }

  function setActiveMode(modeId: string) {
    const colId = activeCollectionId.value
    if (!colId) return
    editor.setActiveMode(colId, modeId)
  }

  return {
    setActiveCollection,
    addCollection,
    renameCollection,
    removeCollection,
    addMode,
    removeMode,
    renameMode,
    setDefaultMode,
    duplicateMode,
    setActiveMode
  }
}

export function createVariableValueActions(
  editor: Editor,
  getActiveCollection: () => VariableCollection | null
) {
  function defaultVariableValue(type: VariableType): VariableValue {
    if (type === 'COLOR') return { ...BLACK }
    if (type === 'FLOAT') return 0
    if (type === 'BOOLEAN') return false
    return ''
  }

  function defaultVariableName(type: VariableType): string {
    if (type === 'COLOR') return 'New color'
    if (type === 'FLOAT') return 'New number'
    if (type === 'BOOLEAN') return 'New boolean'
    return 'New text'
  }

  /** Adds a variable to the active collection and returns its id. */
  function addVariable(type: VariableType = 'COLOR'): string | undefined {
    const col = getActiveCollection()
    if (!col) return undefined

    const id = `var:${randomHex(8)}`
    const valuesByMode: Record<string, VariableValue> = {}
    for (const mode of col.modes) {
      valuesByMode[mode.modeId] = defaultVariableValue(type)
    }

    editor.addVariable({
      id,
      name: defaultVariableName(type),
      type,
      collectionId: col.id,
      valuesByMode,
      description: '',
      hiddenFromPublishing: false
    })
    return id
  }

  function removeVariable(id: string) {
    editor.removeVariable(id)
  }

  function renameVariable(id: string, newName: string) {
    editor.renameVariable(id, newName)
  }

  function updateVariableValue(id: string, modeId: string, value: VariableValue) {
    editor.updateVariableValue(id, modeId, value)
  }

  return {
    addVariable,
    removeVariable,
    renameVariable,
    updateVariableValue
  }
}
