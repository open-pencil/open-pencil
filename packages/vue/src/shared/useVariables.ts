import { ref, computed, watch } from 'vue'
import { colorToHexRaw, parseColor, randomHex } from '@open-pencil/core'

import { useEditor } from './editorContext'
import { useSceneComputed } from './useSceneComputed'

import type { Color, Variable, VariableCollection, VariableValue } from '@open-pencil/core'

export function useVariables() {
  const editor = useEditor()
  const searchTerm = ref('')

  function setSearchTerm(term: string) {
    searchTerm.value = term
  }

  const collections = useSceneComputed(() => editor.getCollections())

  const activeCollectionId = ref(collections.value[0]?.id ?? '')
  watch(collections, (cols) => {
    if (!activeCollectionId.value && cols[0]) activeCollectionId.value = cols[0].id
  })

  const activeCollection = computed(() => editor.getCollection(activeCollectionId.value) ?? null)
  const activeModes = computed(() => activeCollection.value?.modes ?? [])

  const variables = useSceneComputed(() => {
    if (!activeCollectionId.value) return [] as Variable[]
    const all = editor.getVariablesForCollection(activeCollectionId.value)
    if (!searchTerm.value) return all
    const q = searchTerm.value.toLowerCase()
    return all.filter((v) => v.name.toLowerCase().includes(q))
  })

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

  function addVariable() {
    const col = activeCollection.value
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
    if (value === undefined) return '—'
    if (typeof value === 'object' && 'r' in value) return colorToHexRaw(value as Color)
    if (typeof value === 'object' && 'aliasId' in value) {
      const aliased = editor.getVariable(value.aliasId)
      return aliased ? `→ ${aliased.name}` : '→ ?'
    }
    return String(value)
  }

  function parseVariableValue(variable: Variable, raw: string): VariableValue | undefined {
    if (variable.type === 'COLOR') {
      return parseColor(raw.startsWith('#') ? raw : `#${raw}`) ?? undefined
    }
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
    editor,
    collections,
    activeCollectionId,
    activeCollection,
    activeModes,
    variables,
    searchTerm,
    setSearchTerm,
    setActiveCollection,
    addCollection,
    renameCollection,
    addVariable,
    removeVariable,
    renameVariable,
    updateVariableValue,
    formatModeValue,
    parseVariableValue,
    shortName
  }
}
