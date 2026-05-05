import { colorToHexRaw, parseColor } from '@open-pencil/core/color'
import { randomHex } from '@open-pencil/core/random'

import type { Editor } from '@open-pencil/core/editor'
import type {
  Variable,
  VariableCollection,
  VariableType,
  VariableValue
} from '@open-pencil/core/scene-graph'
import type { Ref } from 'vue'

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

  return { setActiveCollection, addCollection, renameCollection }
}

export function createVariableValueActions(
  editor: Editor,
  getActiveCollection: () => VariableCollection | null
) {
  function defaultVariableValue(type: VariableType): VariableValue {
    if (type === 'COLOR') return { r: 0, g: 0, b: 0, a: 1 }
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

  function addVariable(type: VariableType = 'COLOR') {
    const col = getActiveCollection()
    if (!col) return

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
    if (variable.type === 'BOOLEAN') return raw.toLowerCase() === 'true'
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
