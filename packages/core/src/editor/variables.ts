import type { Variable, VariableCollection, VariableType, VariableValue } from '../scene-graph'
import type { EditorContext } from './types'

export function createVariableActions(ctx: EditorContext) {
  function getVariablesByType(type: VariableType) {
    return ctx.graph.getVariablesByType(type)
  }

  function getVariable(id: string) {
    return ctx.graph.variables.get(id)
  }

  function resolveColorVariable(id: string) {
    return ctx.graph.resolveColorVariable(id)
  }

  function getVariablesForCollection(collectionId: string) {
    return ctx.graph.getVariablesForCollection(collectionId)
  }

  function getCollection(id: string) {
    return ctx.graph.variableCollections.get(id)
  }

  function getCollections() {
    return [...ctx.graph.variableCollections.values()]
  }

  function getCollectionCount() {
    return ctx.graph.variableCollections.size
  }

  function getVariableCount() {
    return ctx.graph.variables.size
  }


  function renameCollection(id: string, newName: string) {
    const collection = ctx.graph.variableCollections.get(id)
    if (!collection) return
    const prevName = collection.name
    collection.name = newName
    ctx.undo.push({
      label: 'Rename collection',
      forward: () => {
        const c = ctx.graph.variableCollections.get(id)
        if (c) c.name = newName
        ctx.requestRender()
      },
      inverse: () => {
        const c = ctx.graph.variableCollections.get(id)
        if (c) c.name = prevName
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  function addCollection(collection: VariableCollection) {
    ctx.graph.addCollection(collection)
    ctx.undo.push({
      label: 'Add collection',
      forward: () => {
        ctx.graph.addCollection(collection)
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.removeCollection(collection.id)
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  function removeCollection(id: string) {
    const collection = ctx.graph.variableCollections.get(id)
    if (!collection) return
    const snapshot = structuredClone(collection)
    const variables = snapshot.variableIds
      .map((vid) => ctx.graph.variables.get(vid))
      .filter((v): v is Variable => v != null)
      .map((v) => structuredClone(v))
    ctx.graph.removeCollection(id)
    ctx.undo.push({
      label: 'Remove collection',
      forward: () => {
        ctx.graph.removeCollection(id)
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.addCollection(snapshot)
        for (const v of variables) ctx.graph.addVariable(v)
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  function addVariable(variable: Variable) {
    ctx.graph.addVariable(variable)
    ctx.undo.push({
      label: 'Add variable',
      forward: () => {
        ctx.graph.addVariable(variable)
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.removeVariable(variable.id)
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  function removeVariable(id: string) {
    const variable = ctx.graph.variables.get(id)
    if (!variable) return
    const snapshot = structuredClone(variable)
    ctx.graph.removeVariable(id)
    ctx.undo.push({
      label: 'Remove variable',
      forward: () => {
        ctx.graph.removeVariable(id)
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.addVariable(snapshot)
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  function renameVariable(id: string, newName: string) {
    const variable = ctx.graph.variables.get(id)
    if (!variable) return
    const prevName = variable.name
    variable.name = newName
    ctx.undo.push({
      label: 'Rename variable',
      forward: () => {
        const v = ctx.graph.variables.get(id)
        if (v) v.name = newName
        ctx.requestRender()
      },
      inverse: () => {
        const v = ctx.graph.variables.get(id)
        if (v) v.name = prevName
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  function updateVariableValue(id: string, modeId: string, value: VariableValue) {
    const variable = ctx.graph.variables.get(id)
    if (!variable) return
    const prevValue = structuredClone(variable.valuesByMode[modeId])
    const newValue = structuredClone(value)
    variable.valuesByMode[modeId] = newValue
    ctx.undo.push({
      label: 'Update variable value',
      forward: () => {
        const v = ctx.graph.variables.get(id)
        if (v) v.valuesByMode[modeId] = structuredClone(newValue)
        ctx.requestRender()
      },
      inverse: () => {
        const v = ctx.graph.variables.get(id)
        if (v) v.valuesByMode[modeId] = structuredClone(prevValue)
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  return {
    getVariablesByType,
    getVariable,
    resolveColorVariable,
    getVariablesForCollection,
    getCollection,
    getCollections,
    getCollectionCount,
    getVariableCount,
    renameCollection,
    addCollection,
    removeCollection,
    addVariable,
    removeVariable,
    renameVariable,
    updateVariableValue
  }
}
