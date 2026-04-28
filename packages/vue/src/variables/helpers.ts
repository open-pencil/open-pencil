import { colorToHexRaw, parseColor } from '@open-pencil/core/color'
import { randomHex } from '@open-pencil/core/random'

import type { Variable, VariableCollection, VariableValue } from '@open-pencil/core/scene-graph'
import type { Editor } from '@open-pencil/core/editor'
import type { Ref } from 'vue'

export function createVariableCollectionActions(
  editor: Editor,
  activeCollectionId: Ref<string>
) {
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

  return { setActiveCollection, addCollection, renameCollection }
}

export function createVariableValueActions(
  editor: Editor,
  getActiveCollection: () => VariableCollection | null
) {
  function addVariable() {
    const col = getActiveCollection()
    if (!col) return

    const id = `var:${randomHex(8)}`
    const valuesByMode: Record<string, VariableValue> = {}
    for (const mode of col.modes) {
      valuesByMode[mode.modeId] = { r: 0, g: 0, b: 0, a: 1 }
    }

    editor.addVariable({
      id,
      name: 'New variable',
      type: 'COLOR',
      collectionId: col.id,
      valuesByMode,
      description: '',
      hiddenFromPublishing: false
    })
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

  function formatModeValue(variable: Variable, modeId: string): string {
    const value = variable.valuesByMode[modeId]
    if (typeof value === 'object' && 'r' in value) return colorToHexRaw(value)
    if (typeof value === 'object' && 'aliasId' in value) {
      const aliased = editor.getVariable(value.aliasId)
      return aliased ? `→ ${aliased.name}` : '→ ?'
    }
    return String(value)
  }

  function parseVariableValue(variable: Variable, raw: string): VariableValue | undefined {
    if (variable.type === 'COLOR') return parseColor(raw.startsWith('#') ? raw : `#${raw}`)
    if (variable.type === 'FLOAT') {
      const num = parseFloat(raw)
      return isNaN(num) ? undefined : num
    }
    if (variable.type === 'BOOLEAN') return raw === 'true'
    return raw
  }

  function shortName(variable: Variable): string {
    const parts = variable.name.split('/')
    return parts[parts.length - 1] ?? variable.name
  }

  return {
    addVariable,
    removeVariable,
    renameVariable,
    updateVariableValue,
    formatModeValue,
    parseVariableValue,
    shortName
  }
}
